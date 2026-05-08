import { getConfig } from "@axis/config";
import { createLogger } from "../../../../packages/logger/src/index.js";
import express from 'express';
import { getLatest, getByDate } from '../pipeline/digest.js';
import {runPipeline} from '../scheduler/index.js';
import { getDb } from "../db.js";

const log = createLogger('scout:api')
const config = getConfig();
const PORT = process.env.SCOUT_PORT || 3003
const app = express()
app.use(express.json())

app.get('/digest/latest', (req, res) => {
    const digest = getLatest()
    if (!digest) {

        return res.status(404).json({
            ok: false,

            data: null,

            error: {
                code: 'NO_DIGEST',
                message:
                    'no digest available yet — run pipeline first'
            }
        })
    }

    return res.json({
        ok: true,
        data: digest,
        error: null
    })
})

app.get('/digest/:date', (req, res) => {

    const { date } = req.params

    const digest = getByDate(date)

    if (!digest) {

        return res.status(404).json({
            ok: false,

            data: null,

            error: {
                code: 'NOT_FOUND'
            }
        })
    }

    return res.json({
        ok: true,
        data: digest,
        error: null
    })
})

app.get('/jobs', (req, res) => {

    const limit =
        parseInt(req.query.limit || '20')

    const offset =
        parseInt(req.query.offset || '0')

    const min =
        parseFloat(req.query.min_score || '5')

    const db = getDb()

    const jobs = db.prepare(`
     SELECT *
    FROM jobs
    WHERE overall_score >= ?
    ORDER BY overall_score DESC
    LIMIT ?
    OFFSET ?
  `).all(min, limit, offset)

    return res.json({
        ok: true,

        data: {
            jobs,
            limit,
            offset
        },

        error: null
    })
})

app.get('/jobs/saved', (req, res) => {

        const limit = parseInt(req.query.limit || '50')
        const offset = parseInt(req.query.offset || '0')

        const db = getDb()

        const savedJobs = db.prepare(`
            SELECT
                sj.job_id,
                sj.saved_at,
                sj.notes,
                j.*
            FROM saved_jobs sj
            LEFT JOIN jobs j ON j.id = sj.job_id
            ORDER BY sj.saved_at DESC
            LIMIT ?
            OFFSET ?
        `).all(limit, offset)

        return res.json({
                ok: true,
                data: {
                        jobs: savedJobs,
                        limit,
                        offset,
                        total: savedJobs.length,
                },
                error: null
        })
})

app.post('/jobs/:id/save', (req, res) => {

    const { id } = req.params

    const { notes } = req.body || {}

    const db = getDb()

    db.prepare(`
    INSERT OR REPLACE INTO saved_jobs (
      job_id,
      saved_at,
      notes
    )
    VALUES (?, ?, ?)
  `).run(
        id,
        new Date().toISOString(),
        notes || null
    )

    return res.json({
        ok: true,
        data: {
            saved: true
        },

        error: null
    })
})

app.post('/run', async (req, res) => {

    log.info(
        'manual scout pipeline trigger'
    )

    const forceRefresh = String(req.query.refresh || req.body?.refresh || '').toLowerCase() === 'true' ||
        req.query.refresh === '1' ||
        req.body?.refresh === true

    // fire and forget
    runPipeline({ forceRefresh })
        .catch(err => {

            log.error(
                {
                    err: err.message
                },
                'pipeline failed'
            )
        })

    return res.status(202).json({
        ok: true,

        data: {
            message: 'pipeline started'
        },
        error: null
    })
})

app.get('/health', (req, res) => {

    return res.json({
        ok: true,

        data: {
            service: 'scout',
            port: PORT
        },

        error: null
    })
})

app.use((req, res) => {

    return res.status(404).json({
        ok: false,

        data: null,

        error: {
            code: 'NOT_FOUND',
            message: 'route not found'
        }
    })
})

app.use((err, req, res, next) => {

    log.error(
        {
            err: err.message,
            stack: err.stack
        },
        'scout api error'
    )

    return res.status(500).json({
        ok: false,

        data: null,

        error: {
            code: 'INTERNAL_ERROR',
            message: err.message
        }
    })
})

app.listen(PORT, () => {

    log.info(
        {
            port: PORT,
            env: process.env.NODE_ENV || 'development'
        },
        'scout api listening'
    )
})

export default app