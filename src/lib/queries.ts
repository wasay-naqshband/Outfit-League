import { useQuery } from "@tanstack/react-query";
import { fetchConfig, fetchHistory, fetchJob, fetchWallet } from "./tryon-api";
import { useApp } from "./state";
import { isTerminal } from "../types/tryon";
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
      !query.state.data || !isTerminal(query.state.data.job.status)
        ? 4000
        : 240000,
  });
}
