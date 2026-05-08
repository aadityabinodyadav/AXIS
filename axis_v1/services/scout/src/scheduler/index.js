
import { schedule } from 'node-cron'
import { createLogger } from '../../../../packages/logger/src/index.js'

import { scrape } from '../scrapers/remotive.js'
import { scrape as _scrape } from '../scrapers/wellfound.js'
import { scrape as __scrape } from '../scrapers/github.js'
import { scrape as ___scrape } from '../scrapers/nitter.js'
import { filterSeen } from '../pipeline/dedup.js'
import { preFilter } from '../pipeline/filter.js'
import { rankJobs } from '../pipeline/ranker.js'
import { buildDigest } from '../pipeline/digest.js'

const log = createLogger('scout:scheduler')

let isRunning = false

async function runPipeline() {
  if (isRunning) {
    log.warn('pipeline already running — skipping')
    return null
  }

  isRunning = true
  const start = Date.now()
  log.info('pipeline starting')

  try {
    log.info('scraping sources')
    const [remotiveJobs, wellfoundJobs, githubJobs, nitterJobs] =
      await Promise.allSettled([
        scrape(),
        _scrape(),
        __scrape(),
        ___scrape(),
      ])

    const raw = [
      ...(remotiveJobs.status  === 'fulfilled' ? remotiveJobs.value  : []),
      ...(wellfoundJobs.status === 'fulfilled' ? wellfoundJobs.value : []),
      ...(githubJobs.status    === 'fulfilled' ? githubJobs.value    : []),
      ...(nitterJobs.status    === 'fulfilled' ? nitterJobs.value    : []),
    ]

    log.info({ total: raw.length }, 'scraping complete')

    const fresh = filterSeen(raw)

    const filtered = preFilter(fresh)

    log.info({ count: filtered.length }, 'sending to AI ranker')
    const ranked = await rankJobs(filtered)

    const digest = buildDigest(ranked, {
      totalProcessed: raw.length,
      totalFiltered:  raw.length - filtered.length,
    })

    const duration = ((Date.now() - start) / 1000).toFixed(1)
    log.info({ duration: `${duration}s`, topPicks: digest.topPicks.length }, 'pipeline complete')

    return digest

  } catch (err) {
    log.error({ err: err.message }, 'pipeline failed')
    return null
  } finally {
    isRunning = false
  }
}

function start() {
  schedule('15 0 * * *', () => {
    log.info('scheduled pipeline triggered')
    runPipeline()
  })

  log.info('scheduler started — daily at 6AM NPT')
}

export { start, runPipeline }

