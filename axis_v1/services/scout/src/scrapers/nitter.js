import { createLogger } from "../../../../packages/logger/src/index.js"

const log = createLogger('scout:scraper:nitter')

// Nitter instances — try each until one works
const NITTER_INSTANCES = [
  'https://nitter.privacydev.net',
  'https://nitter.poast.org',
  'https://nitter.1d4.us',
]

const QUERIES = [
  'hiring backend engineer remote',
  'hiring golang node typescript remote',
  'fintech backend engineer remote',
]

async function scrape() {
  log.info('scraping nitter')
  const jobs = []

  const instance = await findWorkingInstance()
  if (!instance) {
    log.warn('no working nitter instance — skipping')
    return []
  }

  for (const query of QUERIES) {
    try {
      const encoded = encodeURIComponent(query)
      const url     = `${instance}/search?q=${encoded}&f=tweets`
      const r       = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal:  AbortSignal.timeout(10_000),
      })

      if (!r.ok) continue

      const html    = await r.text()
      const parsed  = parseTweets(html, query)
      jobs.push(...parsed)

    } catch (err) {
      log.warn({ err: err.message, query }, 'nitter query failed')
    }
  }

  // Deduplicate by URL
  const seen   = new Set()
  const unique = jobs.filter(j => {
    if (seen.has(j.url)) return false
    seen.add(j.url)
    return true
  })

  log.info({ count: unique.length }, 'nitter done')
  return unique
}

async function findWorkingInstance() {
  for (const instance of NITTER_INSTANCES) {
    try {
      const r = await fetch(`${instance}/x`, {
        signal: AbortSignal.timeout(5_000)
      })
      if (r.ok) return instance
    } catch { continue }
  }
  return null
}

function parseTweets(html, query) {
  // Simple regex extraction — no DOM parser needed
  const tweetPattern = /<div class="tweet-content[^"]*">([\s\S]*?)<\/div>/g
  const linkPattern  = /href="\/([^/]+)\/status\/(\d+)"/g
  const jobs         = []

  let tweetMatch
  while ((tweetMatch = tweetPattern.exec(html)) !== null) {
    const text = tweetMatch[1]
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    // Only keep if hiring signal is clear
    if (!/(we're hiring|we are hiring|looking for|open role|join our team)/i.test(text)) continue

    // Find corresponding link
    linkPattern.lastIndex = 0
    const linkMatch = linkPattern.exec(html)
    const tweetUrl  = linkMatch
      ? `https://twitter.com/${linkMatch[1]}/status/${linkMatch[2]}`
      : `https://twitter.com/search?q=${encodeURIComponent(query)}`

    jobs.push({
      source:      'twitter',
      id:          `twitter-${linkMatch?.[2] || Math.random().toString(36).slice(2)}`,
      title:       extractRole(text),
      company:     extractCompany(text),
      location:    /remote/i.test(text) ? 'Remote' : 'See tweet',
      url:         tweetUrl,
      description: text.slice(0, 500),
      posted_at:   new Date().toISOString().slice(0, 10),
    })
  }

  return jobs
}

function extractRole(text) {
  const match = text.match(/\b(backend|frontend|fullstack|software|platform|systems?)\s+(engineer|developer)\b/i)
  return match?.[0] || 'Software Engineer'
}

function extractCompany(text) {
  const match = text.match(/at\s+([A-Z][a-zA-Z0-9]+)/i)
  return match?.[1] || 'Unknown'
}

export { scrape }

