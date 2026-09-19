-- ==============================================================================
-- MIGRATION 004: Ampliação da coluna ip_address na tabela audit_logs
-- Permite armazenar cadeias de proxies reversos (x-forwarded-for) e IPv6
-- ==============================================================================

ALTER TABLE audit_logs ALTER COLUMN ip_address TYPE VARCHAR(150);
