import type Database from "better-sqlite3";

const schemaStatements = [
  `
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      created_by_name TEXT NOT NULL,
      is_deleted INTEGER NOT NULL DEFAULT 0
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS document_states (
      doc_id TEXT PRIMARY KEY,
      yjs_state BLOB NOT NULL,
      plain_text TEXT NOT NULL,
      markdown_text TEXT NOT NULL,
      state_revision INTEGER NOT NULL,
      updated_at TEXT NOT NULL
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS document_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      doc_id TEXT NOT NULL,
      snapshot_version INTEGER NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      saved_by_name TEXT NOT NULL,
      saved_at TEXT NOT NULL
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      doc_id TEXT NOT NULL,
      sender_name TEXT NOT NULL,
      message TEXT NOT NULL,
      sent_at TEXT NOT NULL
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS system_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      doc_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS media_assets (
      id TEXT PRIMARY KEY,
      original_name TEXT NOT NULL,
      media_type TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      storage_name TEXT NOT NULL,
      uploaded_by_name TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `
] as const;

export function initializeSchema(database: Database.Database) {
  const transaction = database.transaction(() => {
    for (const statement of schemaStatements) {
      database.prepare(statement).run();
    }
  });

  transaction();
}
