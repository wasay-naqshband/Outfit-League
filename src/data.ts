import type { Palette } from "./theme";

export const art = {
  navy: require("../assets/illustrations/navy.png"),
  rust: require("../assets/illustrations/rust.png"),
  cream: require("../assets/illustrations/cream.png"),
  green: require("../assets/illustrations/green.png"),
  ivory: require("../assets/illustrations/ivory.png"),
};
export type Outfit = {
  id: string;
  name: string;
  category: string;
  palette: Palette;
  image: keyof typeof art;
  source: string;
};
export const outfits: Outfit[] = [
  {
    id: "navy",
    name: "Navy bomber",
    category: "Streetwear",
    palette: "lavender",
    image: "navy",
    source: "Explore",
  },
  {
    id: "cream",
    name: "Cream layers",
    category: "Minimal",
    palette: "coral",
    image: "cream",
    source: "Screenshot",
  },
  {
    id: "rust",
    name: "Rust jacket",
    category: "Streetwear",
    palette: "sun",
    image: "rust",
    source: "TikTok",
  },
  {
    id: "green",
    name: "Green varsity",
    category: "Y2K",
    palette: "mint",
    image: "green",
    source: "Pinterest",
  },
  {
    id: "ivory",
    name: "Everyday layers",
    category: "Minimal",
    palette: "pink",
    image: "ivory",
    source: "Instagram",
  },
];
export const getOutfit = (id?: string | string[]) =>
  outfits.find((item) => item.id === id) ?? outfits[0]!;
export const products = [
  {
    id: "jacket",
    name: "Oversized jacket",
    image: "navy" as const,
    palette: "lavender" as const,
    price: 64,
    budget: 38,
  },
  {
    id: "jeans",
    name: "Baggy jeans",
    image: "ivory" as const,
    palette: "pink" as const,
    price: 48,
    budget: 29,
  },
  {
    id: "sneakers",
    name: "White sneakers",
    image: "green" as const,
    palette: "mint" as const,
    price: 72,
    budget: 42,
  },
];
