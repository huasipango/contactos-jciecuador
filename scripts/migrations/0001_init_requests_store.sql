CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  CREATE TYPE request_type AS ENUM (
    'create_account',
    'update_phone',
    'reset_password',
    'delete_account'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE request_status AS ENUM (
    'draft',
    'pending',
    'approved',
    'rejected',
    'executing',
    'executed',
    'error',
    'rolled_back'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE execution_mode AS ENUM ('automatic', 'manual_approval');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS workspace_requests (
  id UUID PRIMARY KEY,
  type request_type NOT NULL,
  status request_status NOT NULL,
  organizational_unit TEXT NOT NULL DEFAULT '',
  requestor_email TEXT NOT NULL,
  requestor_role TEXT NOT NULL,
  approved_by TEXT,
  rejected_by TEXT,
  executor_email TEXT,
  execution_mode execution_mode NOT NULL,
  batch_id TEXT,
  dry_run BOOLEAN DEFAULT FALSE,
  payload JSONB NOT NULL DEFAULT '{}',
  result JSONB,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  executed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS request_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES workspace_requests (id) ON DELETE CASCADE,
  batch_id TEXT,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  before JSONB,
  after JSONB,
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS execution_locks (
  lock_key TEXT PRIMARY KEY,
  holder_id TEXT NOT NULL,
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_workspace_requests_created_at ON workspace_requests (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workspace_requests_status ON workspace_requests (status);
CREATE INDEX IF NOT EXISTS idx_workspace_requests_requestor ON workspace_requests (requestor_email);
CREATE INDEX IF NOT EXISTS idx_workspace_requests_batch ON workspace_requests (batch_id) WHERE batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_request_id ON request_audit_events (request_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON request_audit_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON request_audit_events (actor);
CREATE INDEX IF NOT EXISTS idx_execution_locks_expires ON execution_locks (expires_at);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS workspace_requests_updated_at ON workspace_requests;
CREATE TRIGGER workspace_requests_updated_at
  BEFORE UPDATE ON workspace_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
