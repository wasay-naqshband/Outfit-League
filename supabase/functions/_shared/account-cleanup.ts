import type { SupabaseClient } from "npm:@supabase/supabase-js@2.118.0";
function checked<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new Error("ACCOUNT_CLEANUP_FAILED");
  return result.data;
}
export async function cleanupAccounts(db: SupabaseClient) {
  // Wait out short-lived signed upload tokens and in-flight requests. Retry on
  // every existing reconciliation tick; no secrets or photos enter the queue.
  const requests = checked(
    await db
      .from("account_deletions")
      .select("*")
      .order("requested_at")
      .limit(5),
  );
  for (const request of requests ?? []) {
    try {
      const ban = await db.auth.admin.updateUserById(request.owner_id, {
        ban_duration: "876000h",
      });
      if (ban.error && ban.error.code !== "user_not_found")
        throw new Error("ACCOUNT_CLEANUP_FAILED");
      if (Date.parse(request.requested_at) > Date.now() - 130 * 60000) continue;
      for (const bucket of ["tryon-private", "library-private"]) {
        // Storage paths can be nested; query the server's object index, not folder listing.
        const objects = checked(
          await db.rpc("account_storage_paths", {
            p_owner: request.owner_id,
            p_bucket: bucket,
          }),
        );
        if (objects?.length)
          checked(
            await db.storage
              .from(bucket)
              .remove(objects.map((x: { name: string }) => x.name)),
          );
        if (objects?.length === 500) throw new Error("MORE_FILES");
      }
      const paths = checked(
        await db
          .from("account_cleanup")
          .select("bucket,path")
          .eq("owner_id", request.owner_id)
          .limit(100),
      );
      // Battle snapshots do not use an owner prefix, so they were queued transactionally.
      for (const item of paths ?? []) {
        checked(await db.storage.from(item.bucket).remove([item.path]));
        checked(
          await db
            .from("account_cleanup")
            .delete()
            .eq("bucket", item.bucket)
            .eq("path", item.path),
        );
      }
      if (paths?.length === 100) throw new Error("MORE_FILES");
      checked(
        await db
          .from("battle_votes")
          .delete()
          .eq("voter_key", request.voter_key),
      );
      // Supabase refuses deletion while a user owns storage objects. Files go first.
      const removed = await db.auth.admin.deleteUser(request.owner_id);
      if (removed.error && removed.error.code !== "user_not_found")
        throw new Error("ACCOUNT_CLEANUP_FAILED");
      checked(
        await db
          .from("account_deletions")
          .delete()
          .eq("owner_id", request.owner_id),
      );
    } catch {
      await db
        .from("account_deletions")
        .update({ attempts: request.attempts + 1 })
        .eq("owner_id", request.owner_id);
    }
  }
  return requests?.length ?? 0;
}
