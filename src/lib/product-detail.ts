export function productDetails(tags: string, style: string) {
  const values: Record<string, string> = {};
  for (const match of tags.matchAll(
    /(?:^|[\s,])(fabric|silhouette|color)_([\p{L}\p{N}-]+)/giu,
  )) {
    const value = match[2]!.replace(/-/g, " ").trim().toLowerCase();
    if (value && !values[match[1]!.toLowerCase()])
      values[match[1]!.toLowerCase()] =
        value[0]!.toUpperCase() + value.slice(1);
  }
  return {
    fabric: values.fabric,
    cut: values.silhouette?.replace(/\b\p{L}/gu, (letter) =>
      letter.toUpperCase(),
    ),
    color: values.color,
    style: style.trim(),
  };
}

export function productPrice(label: string) {
  const match = label
    .trim()
    .match(/^([A-Z]{3}|[$£€])\s*(\d+(?:,\d{3})*(?:\.\d{1,2})?)$/);
  if (!match) return null;
  const currency =
    ({ $: "USD", "£": "GBP", "€": "EUR" } as Record<string, string>)[
      match[1]!
    ] ?? match[1]!;
  const amount = Number(match[2]!.replace(/,/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const short = amount.toLocaleString("en-US", {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return {
    currency,
    amount,
    sticker: currency === "USD" ? "$" + short : currency + " " + short,
    store:
      currency +
      " " +
      amount.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
  };
}

export const productSwatch: Record<string, string> = {
  black: "#14121F",
  white: "#FFFFFF",
  ivory: "#EFE9D7",
  cream: "#FFF3D4",
  brown: "#7B5537",
  blue: "#4374B0",
  navy: "#273851",
  green: "#497958",
  red: "#B63D42",
  pink: "#FF9BD2",
  purple: "#8C69AA",
  grey: "#929295",
  gray: "#929295",
  beige: "#D9C7A3",
  tan: "#BA9469",
  yellow: "#FFE93B",
  orange: "#D88040",
  burgundy: "#793943",
  olive: "#747B4D",
};
