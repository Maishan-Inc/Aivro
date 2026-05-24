CREATE TABLE IF NOT EXISTS models (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  api_key_encrypted TEXT NOT NULL,
  api_key_iv TEXT NOT NULL,
  api_key_masked TEXT NOT NULL,
  supported_sizes TEXT NOT NULL DEFAULT '1024x1024,1024x1536,1536x1024',
  supported_qualities TEXT NOT NULL DEFAULT 'auto,high,medium',
  default_size TEXT NOT NULL DEFAULT '1024x1024',
  default_quality TEXT NOT NULL DEFAULT 'auto',
  is_default INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
