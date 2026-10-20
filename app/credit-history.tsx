import React from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import {
  Body,
  Button,
  ErrorState,
  FlatHeader,
  Heading,
  Page,
} from "../src/components/ui";
import { useApp } from "../src/lib/state";
import { creditHistory, type CreditTransaction } from "../src/lib/credits";
import { creditActivity } from "../src/lib/credits-domain";
import { colors, shadow } from "../src/theme";
export default function CreditHistory() {
  const { session } = useApp();
  const activity = useInfiniteQuery({
    queryKey: ["credit-history", session?.user.id],
    enabled: !!session,
    initialPageParam: undefined as CreditTransaction | undefined,
    queryFn: ({ pageParam }) => creditHistory(pageParam),
    getNextPageParam: (page) =>
      page.length === 20 ? page[page.length - 1] : undefined,
  });
  return (
    <Page>
      <FlatHeader title="Credit activity" pill="Private" />
      <View style={{ padding: 20, gap: 16 }}>
        <Body>
          Your balance is managed by the server. A reservation and its
          completion describe the same credit, not two charges.
        </Body>
        {!session ? (
          <Button title="Sign in" onPress={() => router.push("/auth")} />
        ) : activity.isPending ? (
          <Body>Loading your activity…</Body>
        ) : activity.isError ? (
          <ErrorState
            message="We couldn’t load your credit activity."
            retry={() => {
              void activity.refetch();
            }}
          />
        ) : (
          <>
            {!activity.data.pages.flat().length && (
              <Body>No credit activity yet.</Body>
            )}
            {activity.data.pages.flat().map((row) => {
              const item = creditActivity(row.kind);
              return (
                <View
                  key={row.id}
                  style={{
                    padding: 18,
                    gap: 6,
                    borderRadius: 24,
                    backgroundColor: colors.white,
                    ...shadow(0.04),
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      gap: 12,
                      alignItems: "center",
                    }}
                  >
                    <Heading size={21} style={{ flex: 1 }}>
                      {item.title}
                    </Heading>
                    <Body>{item.badge}</Body>
                  </View>
                  <Body>{item.detail}</Body>
                  <Body style={{ fontSize: 12 }}>
                    {new Date(row.created_at).toLocaleString()}
                  </Body>
                </View>
              );
            })}
            {activity.hasNextPage && (
              <Button
                secondary
                title={
                  activity.isFetchingNextPage
                    ? "Loading…"
                    : "Load more activity"
                }
                disabled={activity.isFetchingNextPage}
                onPress={() => {
                  void activity.fetchNextPage();
                }}
              />
            )}
            <Button
              secondary
              title="Refresh activity"
              onPress={() => {
                void activity.refetch();
              }}
            />
          </>
        )}
      </View>
    </Page>
  );
}
