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

const server = http.createServer(app);

server.listen(config.gateway.port, () => {
  log.info({ port: config.gateway.port }, "gateway listening");
});


process.on("SIGINT", () => {
  log.info("shutting down gateway");
  process.exit(0);
});