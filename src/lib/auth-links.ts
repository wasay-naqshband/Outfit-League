import * as Linking from "expo-linking";
export function authRedirect(recovery = false) {
  return Linking.createURL(
    "auth-callback",
    recovery ? { queryParams: { recovery: "1" } } : undefined,
  );
}
