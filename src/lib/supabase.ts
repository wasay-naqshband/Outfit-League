import "react-native-url-polyfill/auto";
import { createClient, processLock } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { createSecureStorage } from "./secure-storage";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
// Native sessions stay in Keychain/Keystore. Web uses the SDK's browser storage.
const nativeStorage = createSecureStorage(SecureStore);
export const supabase =
  url && key
    ? createClient(url, key, {
        auth: {
          storage: Platform.OS === "web" ? undefined : nativeStorage,
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
          flowType: "pkce",
          lock: processLock,
        },
      })
    : null;
