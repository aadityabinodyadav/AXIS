import { createLogger } from "../../../../packages/logger/src/index.js"

const log = createLogger('scout:scraper:wellfound')

// Wellfound public job search URLs for relevant roles
const SEARCHES = [
  'https://wellfound.com/jobs?roles[]=Backend+Engineer&remote=true',
  'https://wellfound.com/jobs?roles[]=Software+Engineer&skills[]=Go&remote=true',
  'https://wellfound.com/jobs?roles[]=Software+Engineer&skills[]=Node.js&remote=true',
]

async function scrape() {
  log.info('scraping wellfound')
  const jobs = []

  for (const url of SEARCHES) {
    try {
      // Wellfound has a JSON data endpoint embedded in the page
      // We fetch the API that powers their search
      const apiUrl = url
        .replace('wellfound.com/jobs', 'wellfound.com/api/v2/jobs')
      
      const r = await fetch(apiUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; personal-job-scout/1.0)',
          'Accept':     'application/json',
        }
      })

      if (!r.ok) {
        log.warn({ status: r.status, url }, 'wellfound request failed')
        continue
      }

      const data = await r.json()
      const listings = data.jobs || data.startupRoles || []

      for (const job of listings.slice(0, 20)) {
        jobs.push(normalize(job))
      }

    } catch (err) {
      log.error({ err: err.message }, 'wellfound scrape error')
    }
  }

  log.info({ count: jobs.length }, 'wellfound done')
  return jobs
}

function normalize(job) {
  return {
    source:      'wellfound',
    id:          `wellfound-${job.id || job.slug || Math.random()}`,
    title:       job.title || job.role || '',
    company:     job.startup?.name || job.company || '',
    location:    job.locationNames?.[0] || 'Remote',
    url:         `https://wellfound.com/jobs/${job.slug || job.id}`,
    description: job.description?.slice(0, 1000) || '',
    posted_at:   job.liveStartAt?.slice(0, 10) || null,
  }
}

export { scrape }