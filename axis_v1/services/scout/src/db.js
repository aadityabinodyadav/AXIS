import Database from "better-sqlite3";
import { getConfig } from "../../../packages/config/src/index.js";
import { createLogger } from "../../../packages/logger/src/index.js";
import fs from 'fs';
import path from 'path';

const log = createLogger('scout:db')
const config = getConfig()

const DB_PATH = path.join(config.db.dir, 'scout.db')
let db

export function getDb(){
    if(db) return db

    fs.mkdirSync(config.db.dir, {recursive: true})
    db = new Database(DB_PATH)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')

    migrate(db)
    log.info({ path: DB_PATH }, 'scout database ready')
    return db  
}

function migrate(db) {
  db.exec(`
    -- Deduplication store — every job we've ever seen
    CREATE TABLE IF NOT EXISTS jobs_seen (
      hash       TEXT PRIMARY KEY,
      source     TEXT NOT NULL,
      first_seen TEXT NOT NULL
    );

    -- Processed and ranked jobs
    CREATE TABLE IF NOT EXISTS jobs (
      id            TEXT PRIMARY KEY,
      source        TEXT NOT NULL,
      title         TEXT NOT NULL,
      company       TEXT NOT NULL,
      location      TEXT,
      url           TEXT NOT NULL,
      description   TEXT,
      stack_match   REAL DEFAULT 0,
      growth_signal REAL DEFAULT 0,
      company_quality REAL DEFAULT 0,
      urgency       REAL DEFAULT 0,
      overall_score REAL DEFAULT 0,
      blurb         TEXT,
      posted_at     TEXT,
      processed_at  TEXT NOT NULL
    );

    -- Daily digests
    CREATE TABLE IF NOT EXISTS digests (
      id              TEXT PRIMARY KEY,
      date            TEXT NOT NULL UNIQUE,
      top_picks       TEXT NOT NULL,   -- JSON array
      decent          TEXT NOT NULL,   -- JSON array
      total_processed INTEGER DEFAULT 0,
      total_filtered  INTEGER DEFAULT 0,
      total_ranked    INTEGER DEFAULT 0,
      created_at      TEXT NOT NULL
    );

    -- Jobs user saved/bookmarked
    CREATE TABLE IF NOT EXISTS saved_jobs (
      job_id    TEXT NOT NULL,
      saved_at  TEXT NOT NULL,
      notes     TEXT,
      PRIMARY KEY (job_id)
    );
  `)
}