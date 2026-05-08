import { createLogger } from "../../../../packages/logger/src/index.js"

const log = createLogger('scout:scraper:github')

// HN Algolia API — finds the latest "Who is hiring" thread
const HN_SEARCH = 'https://hn.algolia.com/api/v1/search?query=Ask+HN+Who+is+hiring&tags=ask_hn&hitsPerPage=1'
const HN_ITEM   = 'https://hacker-news.firebaseio.com/v0/item'

async function scrape() {
  log.info('scraping HN who is hiring')

  try {
    // Find latest hiring thread
    const searchR = await fetch(HN_SEARCH)
    const search  = await searchR.json()
    const thread  = search.hits?.[0]

    if (!thread) {
      log.warn('no hiring thread found')
      return []
    }

    log.info({ threadId: thread.objectID, title: thread.title }, 'found thread')

    // Get all top-level comments (job posts)
    const itemR = await fetch(`${HN_ITEM}/${thread.objectID}.json`)
    const item  = await itemR.json()
    const kids  = (item.kids || []).slice(0, 100)  // first 100 comments

    const jobs = []

    // Fetch comments in batches of 10
    for (let i = 0; i < kids.length; i += 10) {
      const batch = kids.slice(i, i + 10)
      const results = await Promise.allSettled(
        batch.map(id => fetch(`${HN_ITEM}/${id}.json`).then(r => r.json()))
      )

      for (const result of results) {
        if (result.status !== 'fulfilled') continue
        const comment = result.value
        if (!comment?.text || comment.dead || comment.deleted) continue

        const parsed = parseHNComment(comment)
        if (parsed) jobs.push(parsed)
      }
    }

    log.info({ count: jobs.length }, 'github/HN done')
    return jobs

  } catch (err) {
    log.error({ err: err.message }, 'HN scrape failed')
    return []
  }
}

function parseHNComment(comment) {
  const text = comment.text
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()

  // Filter for relevant keywords
  const relevant = /\b(backend|node|go|golang|typescript|rust|python|api|distributed|fintech|payments)\b/i
  if (!relevant.test(text)) return null

  // Extract company name (usually first word or "Company |")
  const companyMatch = text.match(/^([^|:\n]+?)[\s]*[|:]/)
  const company = companyMatch?.[1]?.trim() || 'Unknown'

  return {
    source:      'hn_hiring',
    id:          `hn-${comment.id}`,
    title:       extractTitle(text),
    company,
    location:    extractLocation(text),
    url:         `https://news.ycombinator.com/item?id=${comment.id}`,
    description: text.slice(0, 1000),
    posted_at:   new Date(comment.time * 1000).toISOString().slice(0, 10),
  }
}

function extractTitle(text) {
  const roles = text.match(/\b(senior|junior|mid|lead)?\s*(backend|fullstack|software|systems?|platform)\s*(engineer|developer|architect)\b/i)
  return roles?.[0] || 'Software Engineer'
}

function extractLocation(text) {
  const remote = /\bremote\b/i.test(text)
  const loc    = text.match(/\b([A-Z][a-z]+(?:,\s*[A-Z]{2})?)\b/)
  if (remote) return 'Remote'
  return loc?.[0] || 'See posting'
}

export { scrape }