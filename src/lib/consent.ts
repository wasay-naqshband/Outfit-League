import { Alert, Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const CONSENT_KEY = "outfit-league-tryon-consent-v1";
// Photos go to a third-party AI provider, so ask once per device, then remember.
export async function agreedOnce(provider: string) {
  const prior = await (async () =>
    Platform.OS === "web"
      ? localStorage.getItem(CONSENT_KEY)
      : SecureStore.getItemAsync(CONSENT_KEY))().catch(() => null);
  if (prior === "yes") return true;
  const text = `I’m 18+ and have permission to use these photos. They’re sent privately to ${provider} to make the try-on. Nothing is posted publicly.`;
  const ok = await new Promise<boolean>((resolve) =>
    Platform.OS === "web"
      ? resolve(window.confirm(text))
      : Alert.alert("Before your first try-on", text, [
          { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
          { text: "I agree", onPress: () => resolve(true) },
        ]),
  );
  if (ok)
    await (
      Platform.OS === "web"
        ? Promise.resolve(localStorage.setItem(CONSENT_KEY, "yes"))
        : SecureStore.setItemAsync(CONSENT_KEY, "yes")
    ).catch(() => {});
  return ok;
}
