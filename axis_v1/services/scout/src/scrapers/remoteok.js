import { createLogger } from "../../../../packages/logger/src/index.js"

const log = createLogger('scout:scraper:remoteok')

const API = 'https://remoteok.com/api'

async function scrape() {
  log.info('scraping remoteok')
  const jobs = []

  try {
    const r = await fetch(API, { headers: { 'User-Agent': 'axis-scout/1.0 (https://example.com)' } })
    const data = await r.json()

    // remoteok returns an array where the first element is meta info
    const rows = Array.isArray(data) ? data.slice(1) : []

    for (const job of rows) {
      try {
        jobs.push(normalize(job))
      } catch (err) {
        log.error({ err: err.message, jobId: job?.id }, 'remoteok normalize failed')
      }
    }
  } catch (err) {
    log.error({ err: err.message }, 'remoteok fetch failed')
  }

  log.info({ count: jobs.length }, 'remoteok done')
  return jobs
}

function normalize(job) {
  return {
    source: 'remoteok',
    id: `remoteok-${job.id}`,
    title: job.position || job.title || '',
    company: job.company || job.company_name || '',
    location: job.location || job?.tags?.join(', ') || 'Remote',
    url: job.url || job?.apply_url || '',
    description: stripHtml(job.description || job.position || '').slice(0, 1000),
    posted_at: job.date || job?.date_posted || null,
  }
}

function stripHtml(html) {
  return String(html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

export { scrape }
