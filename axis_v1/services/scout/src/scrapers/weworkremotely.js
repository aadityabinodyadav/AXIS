import { createLogger } from "../../../../packages/logger/src/index.js"

const log = createLogger('scout:scraper:weworkremotely')

const RSS = 'https://weworkremotely.com/categories/remote-programming-jobs.rss'

async function scrape() {
  log.info('scraping weworkremotely (rss)')
  const jobs = []

  try {
    const r = await fetch(RSS, { headers: { 'User-Agent': 'axis-scout/1.0' } })
    const xml = await r.text()

    const items = xml.match(/<item>[\s\S]*?<\/item>/gi) || []

    for (const item of items) {
      try {
        const title = extract(item, 'title')
        const link = extract(item, 'link')
        const description = extract(item, 'description')
        const pubDate = extract(item, 'pubDate')

        jobs.push({
          source: 'weworkremotely',
          id: `weworkremotely-${hash(link || title)}`,
          title: stripHtml(title || '').slice(0, 200),
          company: '',
          location: 'Remote',
          url: link || '',
          description: stripHtml(description || '').slice(0, 1000),
          posted_at: pubDate || null,
        })
      } catch (err) {
        log.error({ err: err.message }, 'weworkremotely parse item failed')
      }
    }
  } catch (err) {
    log.error({ err: err.message }, 'weworkremotely fetch failed')
  }

  log.info({ count: jobs.length }, 'weworkremotely done')
  return jobs
}

function extract(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}>([\s\S]*?)<\/${tag}>`, 'i'))
  return m ? m[1].trim() : ''
}

function stripHtml(s) {
  return String(s || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

function hash(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i) | 0
  return Math.abs(h)
}

export { scrape }
