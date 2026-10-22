import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { gradients } from "../theme";

// First-launch answers, kept on this device so a killed app resumes mid-flow.
// ponytail: device-only; sync to the profile when answers are used server-side.
export type Answers = {
  step: number;
  done?: boolean;
  frequency?: string;
  painPoints: string[];
  yearlyWaste?: string;
  styles: string[];
  tryOnPhotoAdded?: boolean;
};
const KEY = "outfit-league-onboarding-v1";
const empty: Answers = { step: 0, painPoints: [], styles: [] };

async function load(): Promise<Answers> {
  const raw = await (
    Platform.OS === "web"
      ? Promise.resolve(localStorage.getItem(KEY))
      : SecureStore.getItemAsync(KEY)
  ).catch(() => null);
  try {
    return raw ? { ...empty, ...JSON.parse(raw) } : empty;
  } catch {
    return empty;
  }
}
async function store(answers: Answers) {
  const raw = JSON.stringify(answers);
  await (
    Platform.OS === "web"
      ? Promise.resolve(localStorage.setItem(KEY, raw))
      : SecureStore.setItemAsync(KEY, raw)
  ).catch(() => {});
}

export function useOnboarding() {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["onboarding"],
    queryFn: load,
    staleTime: Infinity,
  });
  const answers = query.data ?? empty;
  const update = (change: Partial<Answers>) => {
    const next = { ...answers, ...change };
    client.setQueryData(["onboarding"], next);
    void store(next);
  };
  return { answers, ready: !query.isPending, update };
}

export const STYLE_OPTIONS = [
  {
    id: "streetwear",
    label: "Streetwear",
    tint: gradients.lavender,
    art: "navy",
  },
  {
    id: "minimal",
    label: "Minimal",
    tint: ["#F6F3EA", "#E3DFD2"],
    art: "ivory",
  },
  { id: "y2k", label: "Y2K", tint: gradients.pink, art: "cream" },
  { id: "vintage", label: "Vintage", tint: gradients.sun, art: "rust" },
  { id: "eastern", label: "Eastern", tint: gradients.mint, art: "green" },
  { id: "formal", label: "Formal", tint: gradients.coral, art: "navy" },
] as const;
export const styleLabel = (id: string) =>
  STYLE_OPTIONS.find((style) => style.id === id)?.label ?? id;
