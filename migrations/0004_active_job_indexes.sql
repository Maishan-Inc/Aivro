ALTER TABLE jobs ADD COLUMN client_ip TEXT;

CREATE INDEX IF NOT EXISTS idx_jobs_active_device
  ON jobs(anonymous_device_id)
  WHERE status IN ('queued', 'running') AND anonymous_device_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_active_ip
  ON jobs(client_ip)
  WHERE status IN ('queued', 'running') AND client_ip IS NOT NULL;

INSERT OR IGNORE INTO app_settings(key, value, value_type, group_name, description, is_public, updated_at)
VALUES
('QUEUE_BLOCK_BY_IP', 'true', 'boolean', 'queue', 'Block anonymous users from concurrent jobs by IP (may cause false positives behind NAT)', 0, unixepoch());
