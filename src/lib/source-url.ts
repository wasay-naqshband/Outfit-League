export function cleanSourceUrl(value: string) {
  if (!value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (
      !["https:", "http:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.href.length > 2048
    )
      throw new Error();
    return url.href;
  } catch {
    throw new Error(
      "Use a complete http or https link, or leave the link blank.",
    );
  }
}
