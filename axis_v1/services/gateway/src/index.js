import express from "express";
import http from "http";
import { WebSocketServer } from 'ws'
import jwt from 'jsonwebtoken'
import { getConfig } from "../../../packages/config/src/index.js";
import { createLogger } from "../../../packages/logger/src/index.js";
import { generateToken, requireAuth } from "./middleware/auth.js";

const log = createLogger("gateway");
const config = getConfig();

const app = express();
app.use(express.json());

// Simple CORS middleware for development (allows Expo web/dev host).
app.use((req, res, next) => {
  // Allow all origins in dev for convenience; tighten in production.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});


app.use((req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    log.info({
      method: req.method,
      url: req.url,
      status: res.statusCode,
      ms: Date.now() - start,
    }, "request");
  });

  next();
});


app.get("/health", (req, res) => {
  res.json({
    ok: true,
    data: {
      service: "gateway",
      ts: new Date(),
    },
  });
});


app.post("/dev/token", (req, res) => {
  if (config.env === "production") {
    return res.status(404).json({ ok: false });
  }

  const token = generateToken();
  res.json({ ok: true, data: { token } });
});


app.get("/v1/state", requireAuth, async (req, res) => {
  try {
    const r = await fetch(
      `http://localhost:${config.coordinator.port}/state`
    );

    const data = await r.json();
    res.status(r.status).json(data);
  } catch (error) {
    log.error({ err: error.message }, "coordinator unreachable");

    res.status(503).json({
      ok: false,
      error: {
        code: "COORDINATOR_UNREACHABLE",
        message: "coordinator is not responding",
        retryable: true,
      },
    });
  }
});


app.post("/v1/commands", requireAuth, async (req, res) => {
  const body = req.body || {};

  const {
    agentId = "default-agent",
    action,
    params = {},
  } = body;

  if (!action) {
    return res.status(400).json({
      ok: false,
      error: {
        code: "MISSING_ACTION",
        message: "action is required",
      },
    });
  }

  try {
    const r = await fetch(
      `http://localhost:${config.coordinator.port}/commands`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          agentId,
          action,
          params,
        }),
      }
    );

    const data = await r.json();
    return res.json(data);

  } catch (error) {
    log.error({ err: error.message }, "command failed");

    return res.status(503).json({
      ok: false,
      error: {
        code: "COORDINATOR_UNREACHABLE",
        retryable: true,
      },
    });
  }
});


app.get("/v1/commands/:id", requireAuth, async (req, res) => {
  try {
    const r = await fetch(
      `http://localhost:${config.coordinator.port}/commands/${req.params.id}`
    );

    const data = await r.json();
    res.json(data);

  } catch {
    res.status(503).json({
      ok: false,
      error: { code: "COORDINATOR_UNREACHABLE" },
    });
  }
});


app.post('/v1/chat', requireAuth, async (req,res)=>{
  const {message, sessionId} = req.body

  if(!message){
    return res.status(400).json({
      ok: false,
      error: { code: 'MISSING_MESSAGE' }
    })
  }

  try {
    const r = await fetch(
        `http://localhost:${process.env.BRAIN_PORT || 3002}/chat`,
        {
          method: 'POST',
          headers:{
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({message, sessionId})  
        }
    )

    const data = await r.json()
    res.json(data)
  } catch (error) {
    res.status(503).json({
      ok: false,
      error: {code: 'BRAIN_UNREACHABLE', retryable: true}
    })
  }
})

app.get('/v1/memory/core', requireAuth, async (req, res) => {
  try {
    const r    = await fetch(`http://localhost:${process.env.BRAIN_PORT || 3002}/memory/core`)
    const data = await r.json()
    res.json(data)
  } catch {
    res.status(503).json({ ok: false, error: { code: 'BRAIN_UNREACHABLE' } })
  }
})

app.get('/v1/digest/latest', requireAuth, async (req, res) => {
  try {
    const r    = await fetch(`http://localhost:${process.env.SCOUT_PORT || 3003}/digest/latest`)
    const data = await r.json()
    res.json(data)
  } catch {
    res.status(503).json({ ok: false, error: { code: 'SCOUT_UNREACHABLE' } })
  }
})

app.get('/v1/jobs', requireAuth, async (req, res) => {
  try {
    const r    = await fetch(`http://localhost:${process.env.SCOUT_PORT || 3003}/jobs${req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''}`)
    const data = await r.json()
    res.json(data)
  } catch {
    res.status(503).json({ ok: false, error: { code: 'SCOUT_UNREACHABLE' } })
  }
})

app.post('/v1/scout/run', requireAuth, async (req, res) => {
  try {
    const r    = await fetch(`http://localhost:${process.env.SCOUT_PORT || 3003}/run`, { method: 'POST' })
    const data = await r.json()
    res.json(data)
  } catch {
    res.status(503).json({ ok: false, error: { code: 'SCOUT_UNREACHABLE' } })
  }
})

const server = http.createServer(app);

try {
  const wss = new WebSocketServer({
    server,
    path: '/v1/stream'
  })

  wss.on('connection', (ws) => {
    let authed = false
    let authTimer = null

    // Simple per-connection rate limiting
    let lastMsg = 0

    /**
     * Force auth within 5 seconds
     */
    authTimer = setTimeout(() => {
      if (!authed) {
        ws.close(4001, 'auth timeout')
      }
    }, 5000)

    ws.on('message', (raw) => {

      /**
       * Rate limit:
       * max ~20 msgs/sec per connection
       */
      const now = Date.now()

      if (now - lastMsg < 50) {
        return
      }

      lastMsg = now

      try {
        const msg = JSON.parse(raw.toString())

        /**
         * AUTH HANDSHAKE
         */
        if (msg.type === 'AUTH') {
          try {
            const payload = jwt.verify(
              msg.payload?.token,
              config.gateway.jwtSecret
            )

            ws.user = payload
            authed = true

            clearTimeout(authTimer)

            ws.send(JSON.stringify({
              type: 'AUTH_OK',
              payload: {
                user: payload
              }
            }))

            log.info(
              {
                user: payload.sub || payload.id || 'unknown'
              },
              'ws client authenticated'
            )

          } catch (err) {

            ws.send(JSON.stringify({
              type: 'AUTH_FAIL'
            }))

            return ws.close(4001, 'invalid token')
          }

          return
        }

        /**
         * Reject everything before auth
         */
        if (!authed) {
          return ws.close(4001, 'unauthorized')
        }

        /**
         * AUTHENTICATED MESSAGE HANDLING
         */

        switch (msg.type) {

          case 'PING': {
            ws.send(JSON.stringify({
              type: 'PONG',
              ts: Date.now()
            }))
            break
          }

          case 'SUBSCRIBE_LOGS': {
            ws.send(JSON.stringify({
              type: 'SUBSCRIBED',
              channel: 'logs'
            }))
            break
          }

          default: {
            ws.send(JSON.stringify({
              type: 'ERROR',
              error: {
                code: 'UNKNOWN_MESSAGE_TYPE'
              }
            }))
          }
        }

      } catch (err) {

        ws.send(JSON.stringify({
          type: 'ERROR',
          error: {
            code: 'INVALID_MESSAGE'
          }
        }))
      }
    })

    ws.on('close', () => {
      clearTimeout(authTimer)

      log.info(
        {
          user: ws.user?.sub || ws.user?.id || 'unknown'
        },
        'ws client disconnected'
      )
    })

    ws.on('error', (err) => {
      log.error(
        {
          err: err.message
        },
        'ws error'
      )
    })
  })

  log.info('websocket stream initialized')

} catch (err) {

  log.error(
    {
      err: err.message
    },
    'failed to initialize websocket server'
  )
}

server.listen(config.gateway.port, () => {
  log.info({ port: config.gateway.port }, "gateway listening");
});


function registerExitHandler(name, handler) {
  process._registeredExitHandlers = process._registeredExitHandlers || new Set()
  if (process._registeredExitHandlers.has(name)) return
  process._registeredExitHandlers.add(name)
  process.on('SIGINT', handler)
}

registerExitHandler('gateway', () => {
  log.info("shutting down gateway");
  process.exit(0);
});