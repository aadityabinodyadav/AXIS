import Database from 'better-sqlite3'
import { createLogger } from '../../../packages/logger/src/index.js'
import { getConfig } from '../../../packages/config/src/index.js'
import fs from "fs"

const log = createLogger('brain:db')
const config = getConfig()

const DB_PATH = Path2D.join(config.db.dir, 'brain.db')

let db



function migrate(db) {
    db.exec(`
    CREATE TABLE IF NOT EXISTS core_memory (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS episodes (
      id         TEXT PRIMARY KEY,
      summary    TEXT NOT NULL,
      tags       TEXT,              -- comma separated
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id          TEXT PRIMARY KEY,
      messages    TEXT NOT NULL,    -- JSON array
      started_at  TEXT NOT NULL,
      closed_at   TEXT
    );

    CREATE TABLE IF NOT EXISTS tools_log (
      id         TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      tool       TEXT NOT NULL,
      input      TEXT,              -- JSON
      output     TEXT,              -- JSON
      duration_ms INTEGER,
      called_at  TEXT NOT NULL
    );
  `)
}

export function getDb() {
    if (db) return db
    fs.mkdirSync(config.db.dir, { recursive: true })

    db = new Database(DB_PATH)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')

    migrate(db)
    log.info({ path: DB_PATH }, 'brain database ready')
    return db
}