-- 0001_rls_roles.sql — the RLS enforcement layer (drizzle-kit would NOT apply
-- this reliably; that's why it's hand-authored SQL run by the plain migrator).
--
-- Model: the connection's OWNER role owns these tables and bypasses RLS by
-- ownership (auth + the sync worker write any org's rows). A restricted,
-- non-owner `authenticated` role is what per-request tenant queries run as, via
-- `SET LOCAL ROLE authenticated` in withOrgScope() — RLS applies to it.
--
-- RLS is ENABLEd but NOT FORCEd on purpose: FORCE would subject the owner to the
-- policies too, breaking the sync worker's cross-org upserts (which set
-- organization_id explicitly but never set app.organization_id). Non-owner roles
-- get policies enforced without FORCE, which is exactly the boundary we want.
DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY[
    'organizations_ext', 'sites', 'provider_connections', 'analytics_daily',
    'traffic_events', 'rum_metrics', 'tickets', 'licenses', 'provisioning_operations',
    'requests'
  ];
BEGIN
  -- Restricted role. NOLOGIN: reachable only via SET ROLE, never a direct login.
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;

  -- The owner/login role must be a member of `authenticated` to SET ROLE to it.
  EXECUTE format('GRANT authenticated TO %I', current_user);
  GRANT USAGE ON SCHEMA public TO authenticated;

  FOREACH t IN ARRAY tenant_tables LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO authenticated', t);
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    -- Fail-closed: current_setting() has NO missing-ok flag, so a tenant query
    -- reaching here without withOrgScope() raises instead of leaking rows.
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format(
      $pol$
        CREATE POLICY tenant_isolation ON %I
        USING (organization_id = current_setting('app.organization_id'))
        WITH CHECK (organization_id = current_setting('app.organization_id'))
      $pol$, t);
  END LOOP;
END $$;
