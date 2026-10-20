import * as Linking from "expo-linking";
export function authRedirect(recovery = false, next?: "account") {
  return Linking.createURL(
    "auth-callback",
    recovery || next
      ? {
          queryParams: {
            ...(recovery ? { recovery: "1" } : {}),
            ...(next ? { next } : {}),
          },
        }
      : undefined,
  );
}
