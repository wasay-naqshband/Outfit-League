import React, { createContext, useContext, useEffect, useState } from "react";
import { useApp } from "./state";
import type { LocalPhoto } from "../types/tryon";
import { disposePhoto } from "./photos";

type Draft = {
  person: LocalPhoto | null;
  garment: LocalPhoto | null;
  setPerson: (photo: LocalPhoto | null) => void;
  setGarment: (photo: LocalPhoto | null) => void;
  clear: () => void;
};
const Context = createContext<Draft | null>(null);
export function TryOnDraftProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { session } = useApp();
  const [person, setPerson] = useState<LocalPhoto | null>(null);
  const [garment, setGarment] = useState<LocalPhoto | null>(null);
  useEffect(
    () => () => {
      void disposePhoto(person);
    },
    [person],
  );
  useEffect(
    () => () => {
      void disposePhoto(garment);
    },
    [garment],
  );
  useEffect(() => {
    setPerson(null);
    setGarment(null);
  }, [session?.user.id]);
  return (
    <Context.Provider
      value={{
        person,
        garment,
        setPerson,
        setGarment,
        clear: () => {
          setPerson(null);
          setGarment(null);
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
