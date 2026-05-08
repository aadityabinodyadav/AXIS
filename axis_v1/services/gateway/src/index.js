import express from "express";
import http from "http";
import { getConfig } from "../../../packages/config/src/index.js";
import { createLogger } from "../../../packages/logger/src/index.js";
import { generateToken, requireAuth } from "./middleware/auth.js";

const log = createLogger("gateway");
const config = getConfig();

const app = express();
app.use(express.json());


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