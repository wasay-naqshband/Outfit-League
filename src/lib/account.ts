import { supabase } from "./supabase";
export async function accountAction<T>(
  body: Record<string, unknown>,
): Promise<T> {
  if (!supabase) throw new Error("Please sign in.");
  const { data, error } = await supabase.functions.invoke("account", { body });
  if (error || data?.error) {
    let code = data?.error;
    if (!code && error && "context" in error) {
      try {
        code = (await (error.context as Response).json()).error;
      } catch {}
    }
    throw new Error(
      code === "ACTIVE_JOB"
        ? "Wait for your active try-on to finish, then retry. No deletion has started."
        : code === "REAUTH_REQUIRED"
          ? "Please sign in again before deleting your account."
          : code === "FORBIDDEN"
            ? "Administrator access is required."
            : "The request could not complete. Please retry or contact support.",
    );
  }
  return data as T;
}
