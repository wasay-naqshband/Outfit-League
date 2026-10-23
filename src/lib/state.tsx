import React, { createContext, useContext, useEffect, useState } from "react";
import { AppState, Platform } from "react-native";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { focusManager, useQueryClient } from "@tanstack/react-query";
import { analytics } from "./analytics";
import { identifyPurchasesUser } from "./revenuecat";

type State = {
  session: Session | null;
  ready: boolean;
  saved: string[];
  toggleSaved: (id: string) => void;
  vote: "A" | "B" | null;
  setVote: (vote: "A" | "B") => void;
};
const Context = createContext<State | null>(null);
export function AppProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!supabase);
  const [saved, setSaved] = useState<string[]>([]);
  const [vote, setVote] = useState<"A" | "B" | null>(null);
  useEffect(() => {
    void identifyPurchasesUser(session?.user.id ?? null).catch(() => {});
  }, [session?.user.id]);
  useEffect(() => {
    analytics.reset();
    setSaved([]);
    setVote(null);
    queryClient.removeQueries({
      predicate: (query) => query.queryKey[1] !== session?.user.id,
    });
  }, [session?.user.id, queryClient]);
  useEffect(() => {
    if (!supabase) return;
    let live = true;
    // Subscribe first so an auth event cannot be overwritten by a stale initial read.
    let receivedEvent = false;
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      receivedEvent = true;
      if (live) {
        setSession(next);
        setReady(true);
      }
    });
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (live && !receivedEvent) {
          setSession(data.session);
          setReady(true);
        }
      })
      .catch(() => {
        if (live) setReady(true);
      });
    if (Platform.OS !== "web")
      focusManager.setFocused(AppState.currentState === "active");
    const sub = AppState.addEventListener("change", (state) => {
      if (Platform.OS !== "web") {
        focusManager.setFocused(state === "active");
        state === "active"
          ? supabase?.auth.startAutoRefresh()
          : supabase?.auth.stopAutoRefresh();
      }
    });
    return () => {
      live = false;
      data.subscription.unsubscribe();
      sub.remove();
    };
  }, []);
  return (
    <Context.Provider
      value={{
        session,
        ready,
        saved,
        toggleSaved: (id) =>
          setSaved((old) =>
            old.includes(id) ? old.filter((x) => x !== id) : [...old, id],
          ),
        vote,
        setVote,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useApp() {
  const state = useContext(Context);
  if (!state) throw new Error("AppProvider missing");
  return state;
}
