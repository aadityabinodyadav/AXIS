import { createLogger } from "../../../../packages/logger/src/index.js";
import crypto from "crypto"
import { getDb } from "../db.js";

const log = createLogger('scout:dedup')

function hashJob(job){
    const key = job.url
        ? `${job.source || 'unknown'}-${job.url.toLowerCase().trim()}`
        : `${job.company.toLowerCase().trim()}-${job.title.toLowerCase().trim()}-${job.location?.toLowerCase().trim() || ''}-${job.posted_at || ''}`
    return crypto.createHash('sha256').update(key).digest('hex').slice(0, 16)
}

export function filterSeen(jobs, options = {}){
    const { forceRefresh = false } = options
    const db = getDb()
    const now  = new Date().toISOString()
    const cutoff = new Date(Date.now() - 30 *24 *60 *60* 1000).toISOString()

    const insert = db.prepare(`
        INSERT OR IGNORE INTO jobs_seen (hash, source, first_seen)
        VALUES (?, ?, ?)
        `)
    
    const check = db.prepare(`
        SELECT hash FROM jobs_seen WHERE hash = ? AND first_seen > ?
        `)
    
    const fresh = []

    for (const job of jobs){
        if (forceRefresh) {
            fresh.push(job)
            insert.run(hashJob(job), job.source, now)
            continue
        }

        const hash = hashJob(job)
        const seen = check.get(hash, cutoff)

        if(!seen){
            insert.run(hash, job.source, now)
            fresh.push(job)
        }
    }
    
    log.info({ total: jobs.length, fresh: fresh.length, skipped: jobs.length - fresh.length }, 'dedup complete')
    return fresh
}