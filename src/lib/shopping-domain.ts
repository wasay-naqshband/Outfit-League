export type GarmentHint = {
  category: string;
  keywords: string;
  color: string;
  brand: string;
  basis: "saved_details" | "manual";
};
export type IdentificationSource = {
  name?: string;
  category?: string;
  color?: string;
  brand?: string;
  tags?: string;
};
export interface GarmentIdentifier {
  identify(source: IdentificationSource): Promise<GarmentHint[]>;
}
// This adapter uses provided metadata, never pretends to recognize an image.
export class MetadataGarmentIdentifier implements GarmentIdentifier {
  async identify(source: IdentificationSource): Promise<GarmentHint[]> {
    if (!source.category || source.category === "Other") return [];
    return [
      {
        category: source.category,
        keywords: "",
        color: source.color ?? "",
        brand: source.brand ?? "",
        basis: "saved_details",
      },
    ];
  }
}
export function money(minor: number, currency: string) {
  if (!Number.isSafeInteger(minor) || minor < 0)
    throw new Error("Invalid catalog price.");
  try {
    const formatter = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    });
    const digits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
    return formatter.format(minor / 10 ** digits);
  } catch {
    return `${currency} ${(minor / 100).toFixed(2)}`;
  }
}
export function budgetMinor(text: string): number | null {
  if (!text.trim()) return null;
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(text.trim()))
    throw new Error("Use a price such as 50 or 50.25.");
  const [whole, fraction = ""] = text.trim().split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}
export function verifiedRetailerUrl(
  raw: string,
  hosts: readonly string[],
): string {
  const url = new URL(raw);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    /^(localhost|\[|\d+\.\d+\.\d+\.\d+$)/i.test(url.hostname) ||
    /\.(localhost|local|internal)$/i.test(url.hostname) ||
    !hosts.includes(url.hostname.toLowerCase())
  )
    throw new Error("This retailer link is not approved.");
  return url.toString();
}
export type ComparableProduct = {
  id: string;
  category: string;
  currency: string;
  price_minor: number;
  is_demo: boolean;
  is_test_preview?: boolean;
};
export function comparisonGroups<T extends ComparableProduct>(
  products: T[],
): { key: string; items: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const product of products) {
    const source = product.is_test_preview
      ? "Test snapshot prices"
      : product.is_demo
        ? "Sample prices"
        : "Catalog prices";
    const key = `${product.category} · ${product.currency} · ${source}`;
    groups.set(key, [...(groups.get(key) ?? []), product]);
  }
  return [...groups].map(([key, items]) => ({
    key,
    items: [...items].sort(
      (a, b) => a.price_minor - b.price_minor || a.id.localeCompare(b.id),
    ),
  }));
}
