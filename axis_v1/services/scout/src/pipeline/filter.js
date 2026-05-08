import { createLogger } from "../../../../packages/logger/src/index.js";

const log = createLogger('scout:filter')

const BLOCKLIST = [
    /require.*security clearance/i,
    /US\s*citizen.*required/i,
    /10\+?\s*years/i,
    /15\+?\s*years/i,
    /\bcobol\b/i,
    /\bjava\b(?!script)/i,  // Java but not JavaScript
    /\b\.net\b/i,
    /\bphp\b/i,
]

const RELEVANT_SIGNALS = [
    /\bnode\.?js\b/i, /\btypescript\b/i,
    /\bgolang\b/i, /\bgo\b/,
    /\bbackend\b/i, /\bapi\b/i,
    /\bdistributed\b/i, /\bmicroservice/i,
    /\bfintech\b/i, /\bpayments\b/i,
    /\bfraud\b/i, /\binfrastructure\b/i,
    /\bsystems?\s+engineer/i,
]

const MIN_RELEVANT_SIGNALS = 0

export function preFilter(jobs) {
    const passed = []
    const stats = {
        stale: 0,
        blocklisted: 0,
        lowSignal: 0,
    }
    const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)

    for (const job of jobs) {
        const text = `${job.title} ${job.description}`.toLowerCase()

        if (job.posted_at && new Date(job.posted_at) < cutoff) {
            stats.stale += 1
            continue
        }

        if (BLOCKLIST.some(pattern => pattern.test(text))) {
            stats.blocklisted += 1
            continue
        }

        const signals = RELEVANT_SIGNALS.filter(s => s.test(text)).length

        if (signals < MIN_RELEVANT_SIGNALS) {
            stats.lowSignal += 1
            continue
        }

        passed.push(job)

    }

    log.info({
        input: jobs.length,
        passed: passed.length,
        stale: stats.stale,
        blocklisted: stats.blocklisted,
        lowSignal: stats.lowSignal,
    }, 'pre-filter complete')
    return passed
}