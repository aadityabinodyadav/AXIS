import express from "express"
import http from "http"
import { getConfig } from "../../../packages/config/src/index.js"
import { createLogger } from "../../../packages/logger/src/index.js";

const log = createLogger('gateway');
const config = getConfig();
const app = express();

app.use((req, res, next)=>{
    const start = Date.now()
    res.on('finish', ()=>{
        log.info({
            method: req.method,
            url: req.url,
            status: res.statusCode,
            ms: Date.now() - start,
        },'request')
    })

    next()
})

app.get('/health', async (req,res)=>{
    res.json({
        ok: true,
        data:{
            service:'gateway',
            ts: new Date()
        }
    })
})

app.get('/v1/state', async (req,res)=>{
    try {
        const response = await fetch(`http://localhost:${config.coordinator.port}/state`)
        const data = await response.json()

        res.status(response.status).json(data)
    } catch (error) {
        log.error({ err: error.message }, 'coordinator unreachable')
        res.status(503).json({
            ok: false,
            error: {
                code: 'COORDINATOR_UNREACHABLE',
                message: 'coordinator is not responding',
                retryable: true,
            },
        })
    }
})

const server = http.createServer(app)
server.listen(config.gateway.port, ()=>{
  log.info({ port: config.gateway.port }, 'gateway listening')
})

process.on('SIGINT', () => {
  log.info('shutting down gateway')
  process.exit(0)
})