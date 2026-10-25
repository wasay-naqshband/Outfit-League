import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { router } from "expo-router";
import { accountAction } from "./account";
import { analytics } from "./analytics";

// Notifications, without spam:
// - server pushes (look ready, battle votes/comments/joins), capped 3/hour;
// - on this phone: one comeback nudge after 3 quiet days (never repeats) and
//   a heads-up the day before a free trial ends.
// Permission is asked at a moment that explains itself (first try-on, styling
// or a battle), never on launch. iPhone only.
const ios = Platform.OS === "ios";
let pushToken: string | null = null;

const KINDS = ["look_ready", "battle", "trial", "comeback"] as const;
type Kind = (typeof KINDS)[number];

// Once at startup: no banners while the app is open (the screen already shows
// it), and a tap opens the screen the notification is about.
export function startNotifications() {
  if (!ios) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: false,
      shouldShowList: false,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  const open = (response: Notifications.NotificationResponse | null) => {
    const data = response?.notification.request.content.data ?? {};
    const kind = KINDS.find((k) => k === data.kind);
    if (kind) analytics.track("notification_opened", { kind });
    // Only in-app routes, never a web link.
    if (typeof data.url === "string" && /^\/[a-z0-9/_-]*$/i.test(data.url))
      router.push(data.url as never);
  };
  void Notifications.getLastNotificationResponseAsync().then(open);
  Notifications.addNotificationResponseReceivedListener(open);
}

export async function notificationsAllowed() {
  if (!ios) return false;
  return (await Notifications.getPermissionsAsync()).granted;
}

// Asks once, the first time it's called; later calls only refresh the token.
export async function askForNotifications() {
  if (!ios) return;
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.status === "undetermined") {
      const answer = await Notifications.requestPermissionsAsync();
      analytics.track("notifications_answered", {
        allowed: answer.granted ? "yes" : "no",
      });
    }
    await registerPush();
  } catch {
    /* never blocks the action that asked */
  }
}

// Sends this phone's push token to the signed-in account. Quietly does nothing
// until push is enabled for the app (APNs key + entitlement).
export async function registerPush() {
  if (!ios || !(await notificationsAllowed())) return;
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    pushToken = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    await accountAction({ action: "push-token", token: pushToken });
  } catch {
    /* push not available on this build */
  }
}

// On sign-out, so the next person on this phone doesn't get these.
export async function forgetPush() {
  if (!pushToken) return;
  await accountAction({
    action: "push-token",
    token: pushToken,
    remove: true,
  }).catch(() => {});
  pushToken = null;
}

const COMEBACK: [string, string][] = [
  ["Not sure what to wear? 👀", "Tell your AI stylist where you’re going."],
  ["Your closet misses you 🧥", "Try something new on yourself in seconds."],
  ["Weekend plans? ✨", "Get a full outfit styled on you."],
];
const at = (date: Date, kind: Kind, title: string, body: string) =>
  Notifications.scheduleNotificationAsync({
    identifier: kind,
    content: {
      title,
      body,
      data: { kind, url: kind === "trial" ? "/settings" : "/stylist" },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
  });

// Each time the app opens: push the comeback nudge 3 days out (6 pm), and keep
// the trial reminder in line with the current trial.
export async function scheduleReminders(trialEndsAt: string | null) {
  if (!ios || !(await notificationsAllowed())) return;
  try {
    const later = new Date();
    later.setDate(later.getDate() + 3);
    later.setHours(18, 0, 0, 0);
    const [title, body] = COMEBACK[later.getDay() % COMEBACK.length]!;
    await at(later, "comeback", title, body);
    const remind = trialEndsAt
      ? new Date(new Date(trialEndsAt).getTime() - 24 * 3600 * 1000)
      : null;
    if (remind && remind.getTime() > Date.now())
      await at(
        remind,
        "trial",
        "Your free trial ends tomorrow",
        "Keep Pro to keep your monthly try-ons, or cancel anytime in Settings.",
      );
    else await Notifications.cancelScheduledNotificationAsync("trial");
  } catch {
    /* reminders are best-effort */
  }
}
