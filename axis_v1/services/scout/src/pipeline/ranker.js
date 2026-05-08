import { createLogger } from "../../../../packages/logger/src/index.js"

const log = createLogger('scout:ranker')

const OPENROUTER_URL =
  'https://openrouter.ai/api/v1/chat/completions'


const MODEL =
  'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free'
  
const BATCH_SIZE = 10

const PROFILE = `
Name: AB
Location: Kathmandu, Nepal

Experience:
1.5 years + active builder

Stack:
Node.js
TypeScript
Go
React Native
C++

Focus:
Distributed systems
Fintech infrastructure
Fraud detection
Infrastructure automation
Developer tooling

Target companies:
Checkout.com
Primer.io
Wise
Revolut
Stripe
Canonical
GitLab
Automattic

Goal:
Remote backend/distributed systems role
Eventually relocate to EU through Blue Card

Avoid:
Pure frontend roles
Low engineering culture
No-growth outsourcing companies
`

export async function rankJobs(jobs) {

  if (!jobs?.length) {
    return []
  }

  const allRanked = []

  for (let i = 0; i < jobs.length; i += BATCH_SIZE) {

    const batch = jobs.slice(i, i + BATCH_SIZE)

    log.info(
      {
        batch: Math.floor(i / BATCH_SIZE) + 1,
        size: batch.length,
        model: MODEL
      },
      'ranking job batch'
    )

    try {

      const ranked = await rankBatch(batch)

      allRanked.push(...ranked)

    } catch (err) {

      log.error(
        {
          err: err.message
        },
        'ranking batch failed'
      )

      allRanked.push(...heuristicRank(batch))
    }
  }

  const sorted = allRanked.sort(
    (a, b) => b.overall_score - a.overall_score
  )

  if (sorted.length) {
    return sorted
  }

  log.warn(
    { count: jobs.length },
    'AI ranker returned no usable jobs; using heuristic fallback'
  )

  return heuristicRank(jobs)
}

async function rankBatch(jobs) {

  const jobList = jobs
    .map((j, idx) => `
[${idx}] ${j.title} at ${j.company}

Location:
${j.location || 'Unknown'}

Source:
${j.source || 'Unknown'}

Description:
${(j.description || '')
  .replace(/\s+/g, ' ')
  .slice(0, 600)}
`)
    .join('\n-------------------\n')

  const response = await fetch(
    OPENROUTER_URL,
    {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json',

        'Authorization':
          `Bearer ${process.env.OPENROUTER_API_KEY}`,

        'HTTP-Referer': 'http://localhost:3000',

        'X-Title': 'AXIS Scout'
      },

      body: JSON.stringify({

        model: MODEL,

        temperature: 0.2,

        max_tokens: 2000,

        messages: [

          {
            role: 'system',

            content: `
You are Scout.

You evaluate jobs for a specific engineer.

Return ONLY valid JSON array.

No markdown.
No explanation.
No extra text.

Candidate profile:

${PROFILE}

Scoring criteria:

- stack_match:
How well does the role fit backend/distributed systems experience?

- growth_signal:
Will this role accelerate engineering growth?

- company_quality:
Engineering quality, reputation, technical depth.

- urgency:
How aggressively should this be applied to quickly?

Return format:

[
  {
    "idx": 0,
    "stack_match": 1-10,
    "growth_signal": 1-10,
    "company_quality": 1-10,
    "urgency": 1-10,
    "overall": 1-10,
    "blurb": "short sharp realistic insight"
  }
]

Rules:

- overall =
  stack_match*0.35 +
  growth_signal*0.30 +
  company_quality*0.20 +
  urgency*0.15

- Skip irrelevant jobs entirely
- Only include jobs with overall >= 5
- Blurbs should sound analytical and realistic
- Prefer backend/infrastructure/platform/distributed systems roles
`
          },

          {
            role: 'user',

            content: `
Rate these ${jobs.length} jobs:

${jobList}
`
          }
        ]
      })
    }
  )

  if (!response.ok) {

    const err = await response.text()

    throw new Error(
      `OpenRouter error: ${response.status} - ${err}`
    )
  }

  const data = await response.json()

  let raw =
    data?.choices?.[0]?.message?.content || '[]'

  raw = raw
    .replace(/```json/g, '')
    .replace(/```/g, '')
    .trim()

  let ratings = []

  try {

    ratings = JSON.parse(raw)

  } catch (err) {

    log.error(
      {
        raw
      },
      'failed parsing AI ranking JSON'
    )

    return heuristicRank(jobs)
  }

  const ranked = ratings.map(r => ({

    ...jobs[r.idx],

    stack_match:
      r.stack_match || 0,

    growth_signal:
      r.growth_signal || 0,

    company_quality:
      r.company_quality || 0,

    urgency:
      r.urgency || 0,

    overall_score:
      r.overall || 0,

    blurb:
      r.blurb || 'No analysis generated.'
  }))

  return ranked.sort((a, b) => b.overall_score - a.overall_score)
}

function heuristicRank(jobs) {
  return jobs
    .map(job => {
      const text = `${job.title || ''} ${job.company || ''} ${job.location || ''} ${job.description || ''}`.toLowerCase()

      const stack_match = scoreTerms(text, [
        ['backend', 2],
        ['go', 2],
        ['golang', 2],
        ['node', 2],
        ['typescript', 1.5],
        ['javascript', 1],
        ['api', 1],
        ['microservice', 1],
        ['distributed', 1.5],
        ['systems', 1.5],
        ['platform', 1],
        ['infrastructure', 1.5],
      ])

      const growth_signal = scoreTerms(text, [
        ['fintech', 2],
        ['payments', 1.5],
        ['security', 1],
        ['scalable', 1],
        ['distributed', 1],
        ['developer tools', 1],
        ['infra', 1],
      ])

      const company_quality = scoreTerms(text, [
        ['stripe', 2],
        ['wise', 2],
        ['revolut', 2],
        ['checkout.com', 2],
        ['primer', 2],
        ['automattic', 2],
        ['canonical', 1.5],
        ['gitlab', 1.5],
        ['remote', 0.5],
      ])

      const urgency = scoreTerms(text, [
        ['hiring', 1.5],
        ['immediate', 1.5],
        ['urgent', 1.5],
        ['open role', 1],
        ['apply', 0.5],
      ])

      const overall_score = roundOne(
        stack_match * 0.35 +
        growth_signal * 0.30 +
        company_quality * 0.20 +
        urgency * 0.15
      )

      return {
        ...job,
        stack_match: roundOne(stack_match),
        growth_signal: roundOne(growth_signal),
        company_quality: roundOne(company_quality),
        urgency: roundOne(urgency),
        overall_score,
        blurb: job.blurb || heuristicBlurb(job, overall_score),
      }
    })
    .sort((a, b) => b.overall_score - a.overall_score)
}

function scoreTerms(text, terms) {
  let score = 0

  for (const [term, weight] of terms) {
    if (text.includes(term)) {
      score += weight
    }
  }

  return Math.min(10, score)
}

function roundOne(value) {
  return Math.round(value * 10) / 10
}

function heuristicBlurb(job, score) {
  if (score >= 8) return 'Strong match for backend/infrastructure focus.'
  if (score >= 6) return 'Good fit with relevant stack and domain signals.'
  return 'Partial match; worth a quick review.'
}

