import { Linking } from "react-native";
import { authRedirect } from "./auth-links";
import { supabase } from "./supabase";

export type SocialProvider = "google" | "apple";

export async function startOAuth(provider: SocialProvider, next?: "account") {
  if (!supabase) throw new Error("Authentication is not configured");
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: authRedirect(false, next),
      skipBrowserRedirect: true,
    },
  });
  if (error || !data.url) throw error ?? new Error("Missing sign-in URL");
  await Linking.openURL(data.url);
}
