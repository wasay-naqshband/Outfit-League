// Only trust Cloudflare's edge-supplied client address. X-Forwarded-For is a
// list that can contain caller-controlled values unless every proxy hop is
// configured and parsed correctly.
export function trustedClientIp(headers: Headers): string | null {
  const value = headers.get("cf-connecting-ip")?.trim();
  if (!value || value.includes(",") || value.includes("%")) return null;

  const ipv4 = value.split(".");
  if (
    ipv4.length === 4 &&
    ipv4.every((part) => /^(0|[1-9]\d{0,2})$/.test(part) && Number(part) <= 255)
  )
    return ipv4.map(Number).join(".");

  try {
    const hostname = new URL(`http://[${value}]/`).hostname;
    return hostname.startsWith("[") && hostname.endsWith("]")
      ? hostname.slice(1, -1).toLowerCase()
      : null;
  } catch {
    return null;
  }
}
