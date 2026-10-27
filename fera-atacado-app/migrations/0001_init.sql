-- Painel Fera: somente os totais do dia ficam armazenados.
CREATE TABLE IF NOT EXISTS sellers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  whatsapp INTEGER NOT NULL DEFAULT 0 CHECK (whatsapp >= 0),
  attender INTEGER NOT NULL DEFAULT 0 CHECK (attender >= 0),
  vivo_digital INTEGER NOT NULL DEFAULT 0 CHECK (vivo_digital >= 0)
);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seller_id INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  channel TEXT NOT NULL,
  change INTEGER NOT NULL,
  logged_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
INSERT OR IGNORE INTO app_meta (key, value) VALUES ('date', '');
INSERT OR IGNORE INTO app_meta (key, value) VALUES ('settings', '{"rotation":11,"ticker":42,"auto":true}');
CREATE TABLE IF NOT EXISTS login_attempts (ip_hash TEXT PRIMARY KEY, attempts INTEGER NOT NULL, window_start INTEGER NOT NULL);
