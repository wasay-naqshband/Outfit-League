// Only the events and values listed here can be sent (to PostHog, wired in
// posthog.ts): never photos, text, emails or links.
const STEPS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"] as const;
const PLANS = ["yearly", "monthly", "pack"] as const;
export type AnalyticsEvents = {
  onboarding_step: { step: (typeof STEPS)[number] };
  paywall_opened: { source: "credits" | "feature" | "direct" };
  purchase_completed: { plan: (typeof PLANS)[number] };
  purchase_failed: { plan: (typeof PLANS)[number] };
  photo_rejected: {
    reason: "no_person" | "group" | "selfie" | "close_up" | "unclear";
  };
  stylist_styled: { from: "ideas" | "closet" };
  shop_look_clicked: {
    part: "top" | "layer" | "bottoms" | "shoes" | "accessory";
  };
  shop_feed_clicked: {
    rail: "style" | "outerwear" | "tops" | "bottoms" | "shoes" | "extras";
  };
  lookalikes_requested: { from: "result" };
  lookalike_clicked: { badge: "closest" | "cheapest" | "other" };
  spin_started: { plan: "pro" };
  look_rated: { source: "ai" };
  scan_completed: { from: "camera" | "gallery" };
  notification_opened: {
    kind: "look_ready" | "battle" | "trial" | "comeback";
  };
  notifications_answered: { allowed: "yes" | "no" };
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
  onboarding_step: { step: STEPS },
  paywall_opened: { source: ["credits", "feature", "direct"] },
  purchase_completed: { plan: PLANS },
  purchase_failed: { plan: PLANS },
  photo_rejected: {
    reason: ["no_person", "group", "selfie", "close_up", "unclear"],
  },
  stylist_styled: { from: ["ideas", "closet"] },
  shop_look_clicked: {
    part: ["top", "layer", "bottoms", "shoes", "accessory"],
  },
  shop_feed_clicked: {
    rail: ["style", "outerwear", "tops", "bottoms", "shoes", "extras"],
  },
  lookalikes_requested: { from: ["result"] },
  lookalike_clicked: { badge: ["closest", "cheapest", "other"] },
  spin_started: { plan: ["pro"] },
  look_rated: { source: ["ai"] },
  scan_completed: { from: ["camera", "gallery"] },
  notification_opened: {
    kind: ["look_ready", "battle", "trial", "comeback"],
  },
  notifications_answered: { allowed: ["yes", "no"] },
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
// The sink is set once at startup (posthog.ts); until then events are dropped.
let sink: Sink | undefined;
export const setAnalyticsSink = (next: Sink) => {
  sink = next;
};
export const analytics = createAnalytics((event) => sink?.(event));
// The photo check's refusal codes, as analytics reasons.
const PHOTO: Record<string, AnalyticsEvents["photo_rejected"]["reason"]> = {
  PHOTO_NO_PERSON: "no_person",
  PHOTO_GROUP: "group",
  PHOTO_SELFIE: "selfie",
  PHOTO_CLOSE_UP: "close_up",
  PHOTO_UNCLEAR: "unclear",
};
export const trackPhotoProblem = (error: unknown) => {
  const reason = PHOTO[error instanceof Error ? error.message : ""];
  if (reason) analytics.track("photo_rejected", { reason });
};
// Screen names without IDs: "/generation/8f…" → "/generation/[id]".
export const screenName = (path: string) =>
  path.replace(/\/[0-9a-f-]{20,}(?=\/|$)/gi, "/[id]") || "/";
