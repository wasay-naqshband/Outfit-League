import React, { createContext, useContext, useEffect, useState } from "react";
import { useApp } from "./state";
import type { LocalPhoto } from "../types/tryon";
import { disposePhoto } from "./photos";

// Outfit pieces worn together in one try-on, in the order they're sent.
export const PARTS = ["top", "bottom", "outer"] as const;
export type Part = (typeof PARTS)[number];
export const PART_LABELS: Record<Part, string> = {
  top: "Top or dress",
  bottom: "Bottoms",
  outer: "Jacket",
};
// Closet categories → outfit slot.
export const slotFor = (category: string): Part =>
  category === "Bottoms" ? "bottom" : category === "Jackets" ? "outer" : "top";

type Draft = {
  person: LocalPhoto | null;
  pieces: Record<Part, LocalPhoto | null>;
  /** The top slot; kept for screens that add a single garment. */
  garment: LocalPhoto | null;
  setPerson: (photo: LocalPhoto | null) => void;
  setPiece: (part: Part, photo: LocalPhoto | null) => void;
  setGarment: (photo: LocalPhoto | null) => void;
  clear: () => void;
};
const Context = createContext<Draft | null>(null);
const empty = { top: null, bottom: null, outer: null };
export function TryOnDraftProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { session } = useApp();
  const [person, setPerson] = useState<LocalPhoto | null>(null);
  const [pieces, setPieces] = useState<Record<Part, LocalPhoto | null>>(empty);
  useEffect(
    () => () => {
      void disposePhoto(person);
    },
    [person],
  );
  for (const part of PARTS)
    // eslint-disable-next-line react-hooks/rules-of-hooks -- fixed-length loop
    useEffect(
      () => () => {
        void disposePhoto(pieces[part]);
      },
      [pieces[part]],
    );
  useEffect(() => {
    setPerson(null);
    setPieces(empty);
  }, [session?.user.id]);
  const setPiece = (part: Part, photo: LocalPhoto | null) =>
    setPieces((current) => ({ ...current, [part]: photo }));
  return (
    <Context.Provider
      value={{
        person,
        pieces,
        garment: pieces.top,
        setPerson,
        setPiece,
        setGarment: (photo) => setPiece("top", photo),
        clear: () => {
          setPerson(null);
          setPieces(empty);
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useTryOnDraft() {
  const draft = useContext(Context);
  if (!draft) throw new Error("Draft provider missing");
  return draft;
}
