import { Linking, Platform } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import * as WebBrowser from "expo-web-browser";
import { authRedirect } from "./auth-links";
import { supabase } from "./supabase";

export type SocialProvider = "google" | "apple";

// Resolves true once signed in, false if the person cancelled.
export async function startOAuth(
  provider: SocialProvider,
  next?: "account",
): Promise<boolean> {
  if (!supabase) throw new Error("Authentication is not configured");
  if (provider === "apple" && Platform.OS === "ios") return appleNative();
  const redirectTo = authRedirect(false, next);
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error || !data.url) throw error ?? new Error("Missing sign-in URL");
  if (Platform.OS === "web") {
    await Linking.openURL(data.url);
    return false;
  }
  // In-app sheet that closes itself on the redirect, instead of leaving for Safari.
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== "success") return false;
  const code = new URL(result.url).searchParams.get("code");
  if (!code) throw new Error("Missing sign-in code");
  const exchange = await supabase.auth.exchangeCodeForSession(code);
  if (exchange.error) throw exchange.error;
  return true;
}

async function appleNative() {
  const nonce = Crypto.randomUUID();
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        nonce,
      ),
    });
    if (!credential.identityToken) throw new Error("Missing Apple token");
    const { error } = await supabase!.auth.signInWithIdToken({
      provider: "apple",
      token: credential.identityToken,
      nonce,
    });
    if (error) throw error;
    return true;
  } catch (e) {
    if ((e as { code?: string }).code === "ERR_REQUEST_CANCELED") return false;
    throw e;
  }
}
