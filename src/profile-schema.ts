// Schema for an additional Instagram profile. Existing primary tables are preserved.
export const profileSchema=[
  "CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS account (id TEXT PRIMARY KEY, username TEXT NOT NULL, token TEXT NOT NULL, expires INTEGER NOT NULL, refreshed INTEGER NOT NULL)",
  "CREATE TABLE IF NOT EXISTS rules (id TEXT PRIMARY KEY, name TEXT NOT NULL, trigger TEXT NOT NULL, media_id TEXT NOT NULL DEFAULT '', keywords TEXT NOT NULL, message TEXT NOT NULL, link TEXT NOT NULL, public_reply TEXT NOT NULL DEFAULT '', active INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL)",
  "CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, account_id TEXT NOT NULL, rule_id TEXT NOT NULL, recipient TEXT NOT NULL, kind TEXT NOT NULL, text TEXT NOT NULL, parent TEXT, status TEXT NOT NULL DEFAULT 'pending', created INTEGER NOT NULL, expires INTEGER NOT NULL, updated INTEGER NOT NULL, detail TEXT NOT NULL DEFAULT '')",
  "CREATE INDEX IF NOT EXISTS jobs_pending ON jobs(status, created)",
  "CREATE INDEX IF NOT EXISTS jobs_updated ON jobs(updated)",
  "CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, detail TEXT NOT NULL, created INTEGER NOT NULL)",
  "CREATE INDEX IF NOT EXISTS events_created ON events(created)",
  "ALTER TABLE rules ADD COLUMN flow TEXT NOT NULL DEFAULT '{}'",
  "ALTER TABLE jobs ADD COLUMN payload TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE jobs ADD COLUMN not_before INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE jobs ADD COLUMN conversation_id TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE jobs ADD COLUMN phase TEXT NOT NULL DEFAULT ''",
  "CREATE TABLE flow_inputs (id TEXT PRIMARY KEY, account_id TEXT NOT NULL, user_id TEXT NOT NULL, rule_id TEXT NOT NULL DEFAULT '', kind TEXT NOT NULL, payload TEXT NOT NULL, created INTEGER NOT NULL, expires INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending', updated INTEGER NOT NULL)",
  "CREATE INDEX flow_inputs_pending ON flow_inputs(status,created)",
  "CREATE INDEX flow_inputs_user ON flow_inputs(account_id,user_id,status)",
  "CREATE TABLE conversations (id TEXT PRIMARY KEY, account_id TEXT NOT NULL, user_id TEXT NOT NULL, rule_id TEXT NOT NULL, stage TEXT NOT NULL, config TEXT NOT NULL, created INTEGER NOT NULL, expires INTEGER NOT NULL, updated INTEGER NOT NULL)",
  "CREATE INDEX conversations_user ON conversations(account_id,user_id,created)",
  "CREATE TABLE contacts (account_id TEXT NOT NULL, user_id TEXT NOT NULL, name TEXT NOT NULL DEFAULT '', email TEXT NOT NULL, rule_id TEXT NOT NULL, created INTEGER NOT NULL, updated INTEGER NOT NULL, PRIMARY KEY(account_id,user_id))",
  "CREATE TABLE contact_tags (account_id TEXT NOT NULL,user_id TEXT NOT NULL,tag TEXT NOT NULL,created INTEGER NOT NULL,PRIMARY KEY(account_id,user_id,tag))"
];
