import { createLogger } from "../../../../packages/logger/src/index.js"

const log = createLogger('scout:scraper:wellfound')

// Wellfound currently blocks generic fetches from this environment.
// Keep the scraper as a graceful no-op unless a working public endpoint is restored.
const SEARCHES = []

async function scrape() {
  log.info('scraping wellfound')
  const jobs = []

  if (!SEARCHES.length) {
    log.info('wellfound disabled — no stable public endpoint available')
    return jobs
  }

  for (const url of SEARCHES) {
    try {
      const r = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; personal-job-scout/1.0)',
          'Accept':     'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        }
      })

      if (!r.ok) {
        log.info({ status: r.status, url }, 'wellfound request failed')
        continue
      }

      const html = await r.text()
      const listings = parseListings(html)

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

function parseListings(html) {
  const matches = [...html.matchAll(/\/jobs\/([^"'?\s]+)/g)]

  return matches.map((match, index) => ({
    id: match[1],
    slug: match[1],
    title: 'Software Engineer',
    company: 'Wellfound',
    locationNames: ['Remote'],
    description: '',
    liveStartAt: new Date().toISOString(),
  })).slice(0, 20)
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