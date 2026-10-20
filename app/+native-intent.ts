export function redirectSystemPath({
  path,
}: {
  path: string;
  initial: boolean;
}) {
  try {
    if (new URL(path).hostname === "expo-sharing")
      return "/library-edit?kind=inspiration&shared=" + Date.now();
  } catch {
    /* Keep ordinary relative routes intact, including auth callbacks. */
  }
  return path;
}
