import { Platform } from "react-native";
import PostHog from "posthog-react-native";
import { setAnalyticsSink } from "./analytics";

// Product analytics and crash reports (iPhone app only). No touch autocapture
// or session replay: only the allow-listed events, screen names, app opens and
// crashes. The person is the random Supabase account ID.
const key = process.env.EXPO_PUBLIC_POSTHOG_KEY;
export const posthog =
  key && Platform.OS === "ios"
    ? new PostHog(key, {
        host: "https://us.i.posthog.com",
        captureAppLifecycleEvents: true,
        enableSessionReplay: false,
        errorTracking: {
          autocapture: { uncaughtExceptions: true, unhandledRejections: true },
        },
      })
    : null;
if (posthog) setAnalyticsSink((e) => posthog.capture(e.name, e.properties));
