import { createLogger } from "../../../../packages/logger/src/index.js"

const log = createLogger('scout:scraper:remotive')

const BASE = 'https://remotive.com/api/remote-jobs'
const RELEVANT_CATEGORIES = [
  'software-dev', 'devops-sysadmin', 'backend'
]

async function scrape() {
  log.info('scraping remotive')
  const jobs = []

  for (const category of RELEVANT_CATEGORIES) {
    try {
      const r    = await fetch(`${BASE}?category=${category}&limit=50`)
      const data = await r.json()

      for (const job of (data.jobs || [])) {
        jobs.push(normalize(job))
      }
    } catch (err) {
      log.error({ err: err.message, category }, 'remotive fetch failed')
    }
  }

  log.info({ count: jobs.length }, 'remotive done')
  return jobs
}

function normalize(job) {
  return {
    source:      'remotive',
    id:          `remotive-${job.id}`,
    title:       job.title || '',
    company:     job.company_name || '',
    location:    job.candidate_required_location || 'Remote',
    url:         job.url || '',
    description: stripHtml(job.description || '').slice(0, 1000),
    posted_at:   job.publication_date?.slice(0, 10) || null,
  }
}

function stripHtml(html) {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

export { scrape }