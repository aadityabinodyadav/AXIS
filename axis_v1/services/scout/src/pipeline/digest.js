
import { createLogger } from '../../../../packages/logger/src/index.js'
import { getDb } from '../db.js'

const log = createLogger('scout:digest')

 function buildDigest(rankedJobs, stats) {
  const db   = getDb()
  const date = new Date().toISOString().slice(0, 10)
  const id   = crypto.randomUUID()

  const topPicks = rankedJobs
    .filter(j => j.overall_score >= 8)
    .slice(0, 5)

  const decent = rankedJobs
    .filter(j => j.overall_score >= 6 && j.overall_score < 8)
    .slice(0, 10)

  const insertJob = db.prepare(`
    INSERT OR REPLACE INTO jobs (
      id, source, title, company, location, url, description,
      stack_match, growth_signal, company_quality, urgency,
      overall_score, blurb, posted_at, processed_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?
    )
  `)

  const now = new Date().toISOString()
  for (const job of rankedJobs) {
    insertJob.run(
      job.id, job.source, job.title, job.company,
      job.location, job.url, job.description,
      job.stack_match, job.growth_signal,
      job.company_quality, job.urgency,
      job.overall_score, job.blurb,
      job.posted_at, now
    )
  }

  db.prepare(`
    INSERT OR REPLACE INTO digests (
      id, date, top_picks, decent,
      total_processed, total_filtered, total_ranked, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, date,
    JSON.stringify(topPicks),
    JSON.stringify(decent),
    stats.totalProcessed,
    stats.totalFiltered,
    rankedJobs.length,
    now
  )

  log.info({
    date,
    topPicks: topPicks.length,
    decent: decent.length,
    total: rankedJobs.length,
  }, 'digest built')

  return { id, date, topPicks, decent, stats }
}

function getLatest() {
  const db = getDb()
  const row = db.prepare(`
    SELECT * FROM digests ORDER BY date DESC LIMIT 1
  `).get()

  if (!row) return null

  return {
    ...row,
    top_picks: JSON.parse(row.top_picks),
    decent:    JSON.parse(row.decent),
  }
}

function getByDate(date) {
  const db  = getDb()
  const row = db.prepare('SELECT * FROM digests WHERE date = ?').get(date)
  if (!row) return null

  return {
    ...row,
    top_picks: JSON.parse(row.top_picks),
    decent:    JSON.parse(row.decent),
  }
}

export  { buildDigest, getLatest, getByDate }