// No analytics provider is connected. Only explicit, non-personal fields may reach a future sink.
export type AnalyticsEvents = {
  signup_completed: { method: "email" };
  onboarding_completed: { mode: "guest" | "account" };
  explore_outfit_opened: { collection: "sample" | "catalog" };
  inspiration_saved: { source: "explore" | "manual" };
  try_on_started: { mode: "live" };
  try_on_completed: { mode: "live" };
  try_on_failed: { mode: "live" };
  look_saved: { source: "ai" };
  battle_created: { voting_mode: "anonymous" | "public" };
  battle_shared: { method: "copy" | "share" };
  vote_submitted: { voting_mode: "anonymous" | "public" };
  shop_saved_look_opened: { source: "library" | "ai" };
  product_clicked: { link: "retailer" | "affiliate" };
  paywall_viewed: { screen: "credit_packs" };
};
type EventName = keyof AnalyticsEvents;
export type SafeEvent = { name: EventName; properties: Record<string, string> };
type Sink = (event: SafeEvent) => void | Promise<void>;
const allowed: {
  [K in EventName]: Record<keyof AnalyticsEvents[K], readonly string[]>;
} = {
  signup_completed: { method: ["email"] },
  onboarding_completed: { mode: ["guest", "account"] },
  explore_outfit_opened: { collection: ["sample", "catalog"] },
  inspiration_saved: { source: ["explore", "manual"] },
  try_on_started: { mode: ["live"] },
  try_on_completed: { mode: ["live"] },
  try_on_failed: { mode: ["live"] },
  look_saved: { source: ["ai"] },
  battle_created: { voting_mode: ["anonymous", "public"] },
  battle_shared: { method: ["copy", "share"] },
  vote_submitted: { voting_mode: ["anonymous", "public"] },
  shop_saved_look_opened: { source: ["library", "ai"] },
  product_clicked: { link: ["retailer", "affiliate"] },
  paywall_viewed: { screen: ["credit_packs"] },
};
export function createAnalytics(sink?: Sink) {
  const seen = new Set<string>();
  function track<K extends EventName>(
    name: K,
    properties: AnalyticsEvents[K],
    onceKey?: string,
  ) {
    if (!sink || !Object.prototype.hasOwnProperty.call(allowed, name)) return;
    if (onceKey && seen.has(onceKey)) return;
    const safe: Record<string, string> = {};
    for (const [key, values] of Object.entries(allowed[name])) {
      const value = (properties as Record<string, unknown>)[key];
      if (
        typeof value !== "string" ||
        !(values as readonly string[]).includes(value)
      )
        return;
      safe[key] = value;
    }
    if (onceKey) {
      if (seen.size >= 500) seen.clear();
      seen.add(onceKey);
    }
    try {
      void Promise.resolve(sink({ name, properties: safe })).catch(() => {});
    } catch {
      /* Metrics never interrupt the app. */
    }
  }
  return { track, reset: () => seen.clear(), enabled: !!sink };
}
// Deliberately no network, storage, console output, identifiers, or default telemetry.
export const analytics = createAnalytics();
