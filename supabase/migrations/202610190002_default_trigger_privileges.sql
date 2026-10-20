-- Supabase's optional automatic-RLS event trigger needs no API execution grant.
-- It keeps working as a database event trigger after removing client access.
do $$ begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public,anon,authenticated;
  end if;
end $$;
