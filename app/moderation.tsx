import React, { useState } from "react";
import { View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Body, Button, FlatHeader, Heading, Page } from "../src/components/ui";
import { accountAction } from "../src/lib/account";
import { useApp } from "../src/lib/state";
type Reports = {
  reports: { battle_id: string; reason: string; created_at: string }[];
  battles: { id: string; title: string; status: string }[];
  comments: {
    id: number;
    battle_id: string;
    display_name: string;
    body: string;
    hidden: boolean;
    reports: number;
  }[];
};
export default function Moderation() {
  const { session } = useApp();
  const [confirm, setConfirm] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const query = useQuery({
    queryKey: ["moderation", session?.user.id],
    queryFn: () => accountAction<Reports>({ action: "reports" }),
    enabled: !!session,
    retry: false,
  });
  async function removeComment(id: number) {
    setBusy(true);
    try {
      await accountAction({ action: "remove-comment", id });
      await query.refetch();
      setMessage("Comment removed.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Please retry.");
    } finally {
      setBusy(false);
    }
  }
  async function hide(id: string) {
    setBusy(true);
    try {
      await accountAction({ action: "hide", id });
      setConfirm(null);
      await query.refetch();
      setMessage(
        "Battle hidden. Existing image links expire within one minute.",
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Please retry.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page>
      <FlatHeader title="Review reports" pill="Admin" />
      <View style={{ padding: 20, gap: 16 }}>
        <Body>
          Restricted to administrators explicitly appointed by the server
          operator. Battles stay up until you hide them; a comment hides itself
          after two reports until you remove it.
        </Body>
        {!session ? (
          <Button title="Sign in" onPress={() => router.push("/auth")} />
        ) : query.isPending ? (
          <Body>Checking access…</Body>
        ) : query.error ? (
          <>
            <Body>{query.error.message}</Body>
            <Button
              secondary
              title="Retry access check"
              onPress={() => void query.refetch()}
            />
          </>
        ) : (
          <>
            {!query.data?.reports.length && (
              <Body>No reports in the latest review queue.</Body>
            )}
            {!!query.data?.comments?.length && (
              <Heading size={20}>Reported comments</Heading>
            )}
            {query.data?.comments?.map((c) => (
              <View
                key={c.id}
                style={{
                  padding: 16,
                  borderRadius: 22,
                  backgroundColor: "white",
                  gap: 8,
                }}
              >
                <Body>
                  {c.display_name}: “{c.body}”
                </Body>
                <Body style={{ fontSize: 13 }}>
                  {c.reports} report{c.reports === 1 ? "" : "s"}
                  {c.hidden ? " · hidden" : ""}
                </Body>
                <Button
                  title="Remove comment"
                  disabled={busy}
                  onPress={() => void removeComment(c.id)}
                />
              </View>
            ))}
            <Body>Latest 50 battle reports, newest first.</Body>
            {query.data?.battles.map((b) => (
              <View
                key={b.id}
                style={{
                  padding: 16,
                  borderRadius: 22,
                  backgroundColor: "white",
                  gap: 12,
                }}
              >
                <Heading size={22}>{b.title}</Heading>
                <Body>{b.status}</Body>
                {query.data.reports
                  .filter((r) => r.battle_id === b.id)
                  .map((r, i) => (
                    <Body key={i}>
                      {r.reason} · {new Date(r.created_at).toLocaleString()}
                    </Body>
                  ))}
                <Button
                  secondary
                  title="Review battle"
                  onPress={() =>
                    router.push({
                      pathname: "/battle/[id]",
                      params: { id: b.id },
                    })
                  }
                />
                {["published", "closed"].includes(b.status) &&
                  (confirm === b.id ? (
                    <>
                      <Body>Hide this battle from everyone with its link?</Body>
                      <Button
                        title="Confirm hide battle"
                        disabled={busy}
                        onPress={() => void hide(b.id)}
                      />
                      <Button
                        secondary
                        title="Cancel"
                        disabled={busy}
                        onPress={() => setConfirm(null)}
                      />
                    </>
                  ) : (
                    <Button
                      title="Hide battle"
                      onPress={() => setConfirm(b.id)}
                    />
                  ))}
              </View>
            ))}
          </>
        )}
        {!!message && <Body>{message}</Body>}
      </View>
    </Page>
  );
}
