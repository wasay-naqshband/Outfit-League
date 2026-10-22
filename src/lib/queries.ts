import { useQuery } from "@tanstack/react-query";
import { fetchConfig, fetchHistory, fetchJob, fetchWallet } from "./tryon-api";
import { useApp } from "./state";
import { isTerminal } from "../types/tryon";
import { supabase } from "./supabase";
import { loadSavedPhoto } from "./saved-photo";
export function useWallet() {
  const { session } = useApp();
  return useQuery({
    queryKey: ["wallet", session?.user.id],
    queryFn: fetchWallet,
    enabled: !!session,
    staleTime: 10000,
    refetchOnWindowFocus: true,
  });
}
export function useTryOnConfig() {
  const { session } = useApp();
  return useQuery({
    queryKey: ["tryon-config", session?.user.id],
    queryFn: fetchConfig,
    enabled: !!session,
    staleTime: 30000,
    retry: false,
  });
}
export function useHistory() {
  const { session } = useApp();
  return useQuery({
    queryKey: ["tryon-history", session?.user.id],
    queryFn: fetchHistory,
    enabled: !!session,
    refetchInterval: 15000,
    retry: 1,
  });
}
export function useJob(id?: string) {
  const { session } = useApp();
  return useQuery({
    queryKey: ["tryon-job", session?.user.id, id],
    queryFn: () => fetchJob(id!),
    enabled: !!id && !!session,
    staleTime: 0,
    retry: 2,
    refetchInterval: (query) =>
      !query.state.data ||
      !isTerminal(query.state.data.job.status) ||
      query.state.data.spin?.status === "processing"
        ? 4000
        : 240000,
  });
}
export function useProfile() {
  const { session } = useApp();
  const id = session?.user.id;
  return useQuery({
    queryKey: ["profile", id],
    queryFn: async () => {
      const { data, error } = await supabase!
        .from("profiles")
        .select("display_name")
        .eq("id", id!)
        .single();
      if (error) throw error;
      // No photo yet is a normal state, not an error.
      const photo = await supabase!.storage
        .from("avatars")
        .createSignedUrl(`${id}/avatar.jpg`, 3600);
      return {
        name: data.display_name as string,
        avatar: photo.data?.signedUrl ?? null,
      };
    },
    enabled: !!id && !!supabase,
    staleTime: 60000,
  });
}
export function useSavedPhoto() {
  const { session } = useApp();
  const id = session?.user.id;
  return useQuery({
    queryKey: ["saved-photo", id],
    queryFn: () => loadSavedPhoto(id!),
    enabled: !!id && !!supabase,
    staleTime: Infinity,
  });
}
