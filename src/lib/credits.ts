import { supabase } from "./supabase";
import type { CreditKind } from "./credits-domain";
export type CreditTransaction = {
  id: string;
  kind: CreditKind;
  created_at: string;
};
export async function creditHistory(
  cursor?: CreditTransaction,
): Promise<CreditTransaction[]> {
  if (!supabase) throw new Error("Sign in to view credit activity.");
  let query = supabase
    .from("credit_transactions")
    .select("id,kind,created_at")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(20);
  if (cursor)
    query = query.or(
      `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`,
    );
  const { data, error } = await query;
  if (error) throw error;
  return data as CreditTransaction[];
}
