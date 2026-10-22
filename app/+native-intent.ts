export function redirectSystemPath({
  path,
}: {
  path: string;
  initial: boolean;
}) {
  try {
    if (new URL(path).hostname === "expo-sharing")
      return "/try-on?shared=" + Date.now();
  } catch {
    /* Keep ordinary relative routes intact, including auth callbacks. */
  }
  return path;
}
