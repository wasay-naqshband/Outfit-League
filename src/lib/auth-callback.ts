type CallbackParams = {
  code?: string;
  recovery?: string;
  next?: string;
};

// Session tokens from URL fragments are deliberately ignored. All app-created
// email, recovery, and OAuth links use Supabase PKCE authorization codes.
export function parseAuthCallback(url: string | null, params: CallbackParams) {
  const parsed = url ? new URL(url) : null;
  const fragment = new URLSearchParams(parsed?.hash.slice(1) ?? "");
  return {
    code: params.code ?? parsed?.searchParams.get("code") ?? null,
    recovery:
      params.recovery === "1" ||
      parsed?.searchParams.get("recovery") === "1" ||
      fragment.get("type") === "recovery",
    next: params.next ?? parsed?.searchParams.get("next") ?? null,
  };
}
