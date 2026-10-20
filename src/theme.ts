import { Platform } from "react-native";

export const colors = {
  yellow: "#FFE93B",
  ink: "#14121F",
  cream: "#FFFBEA",
  chip: "#FFF7C4",
  white: "#FFFFFF",
  pink: "#FF9BD2",
  text2: "#4B475A",
  text3: "#6B6675",
  placeholder: "#8A8596",
  inactive: "#D8D3E4",
  success: "#4ADE80",
};
export const gradients = {
  yellow: ["#FFF48A", "#FFE93B", "#FFDD1F"],
  lavender: ["#DCD5FF", "#B9ACFF"],
  coral: ["#FFC2B6", "#FF7A66"],
  mint: ["#CFF5E4", "#8EDDBC"],
  sun: ["#FFF1A8", "#FFD43B"],
  pink: ["#FFE0F0", "#FF9BD2"],
} as const;
export type Palette = Exclude<keyof typeof gradients, "yellow">;
export const fonts = {
  heading: "BricolageGrotesque_800ExtraBold",
  body: "Figtree_400Regular",
  medium: "Figtree_500Medium",
  bold: "Figtree_700Bold",
};
export const radii = {
  header: 36,
  card: 28,
  hero: 32,
  button: 18,
  search: 20,
  chip: 22,
  sticker: 14,
  tab: 32,
};
export const shadow = (strength = 0.16) =>
  Platform.select({
    web: { boxShadow: `0px 10px 24px rgba(20,18,31,${strength})` },
    default: {
      shadowColor: colors.ink,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: strength,
      shadowRadius: 12,
      elevation: 6,
    },
  });
