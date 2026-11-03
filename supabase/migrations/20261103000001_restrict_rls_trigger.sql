-- This event trigger protects new public tables by enabling RLS automatically.
-- It is invoked by PostgreSQL during DDL and does not need public RPC access.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
