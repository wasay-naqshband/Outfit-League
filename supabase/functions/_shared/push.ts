// Push notifications through Expo's push service to the person's iPhones.
// Best-effort: a failed push never fails the action that triggered it.
// ponytail: an hourly cap per person (3) is the only throttle beyond each
// caller's own rule; add per-kind daily caps if people still find it noisy.
type Db = {
  rpc: (
    name: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ error: unknown }>;
  from: (table: string) => any; // supabase-js query builder
};
export type Push = {
  title: string;
  body: string;
  url: string; // app route opened on tap, e.g. /generation/<id>
  kind: "look_ready" | "battle";
};

export async function notify(
  db: Db,
  owner: string,
  push: Push,
  request: typeof fetch = fetch,
) {
  try {
    const capped = await db.rpc("battle_rate", {
      p_key: "push:" + owner,
      p_max: 3,
    });
    if (capped.error) return; // over the hourly cap
    const { data } = await db
      .from("push_tokens")
      .select("token")
      .eq("owner_id", owner)
      .limit(5);
    const tokens = ((data ?? []) as { token: string }[]).map((t) => t.token);
    if (!tokens.length) return;
    const response = await request("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(8000),
      body: JSON.stringify(
        tokens.map((to) => ({
          to,
          title: push.title,
          body: push.body,
          sound: "default",
          data: { url: push.url, kind: push.kind },
        })),
      ),
    });
    const tickets = ((await response.json())?.data ?? []) as {
      details?: { error?: string };
    }[];
    // Uninstalled apps: forget their tokens.
    const gone = tokens.filter(
      (_, i) => tickets[i]?.details?.error === "DeviceNotRegistered",
    );
    if (gone.length) await db.from("push_tokens").delete().in("token", gone);
  } catch {
    /* best-effort */
  }
}
