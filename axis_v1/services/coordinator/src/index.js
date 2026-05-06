import { getConfig } from "../../../packages/config/src/index.js";
import { createLogger } from "../../../packages/logger/src/index.js";

import http from "http";
import express from "express";
import { WebSocketServer } from "ws";
import crypto from "crypto";

import { AgentRegistry } from "./agent/registry.js";
import { MessageType, validateMessage, buildMessage } from "../../../packages/protocol/messages.js";

const log = createLogger("coordinator");
const config = getConfig();

const registry = new AgentRegistry(config);

const commands = new Map();

const app = express();
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ ok: true, data: { service: "coordinator" } });
});

app.get("/state", (req, res) => {
  const agents = registry.all().map(a => ({
    id: a.id,
    status: a.status,
    connectedAt: a.connectedAt,
    lastHeartbeat: a.lastHeartbeat,
    snapshot: a.lastSnapshot
  }));

  res.json({ ok: true, data: { agents } });
});

app.post("/commands", (req, res) => {
  const { agentId = "default-agent", action, params = {} } = req.body;

  if (!action) {
    return res.status(400).json({
      ok: false,
      error: { code: "MISSING_ACTION" }
    });
  }

  const agent = registry.get(agentId);

  if (!agent) {
    return res.status(503).json({
      ok: false,
      error: { code: "AGENT_UNREACHABLE" }
    });
  }

  const commandId = crypto.randomUUID();

  const command = {
    id: commandId,
    agentId,
    action,
    params,
    status: "sent",
    output: null,
    error: null
  };

  commands.set(commandId, command);

  const msg = buildMessage(MessageType.COMMAND, "coordinator", {
    commandId,
    action,
    params
  });

  agent.ws.send(JSON.stringify(msg));

  res.json({
    ok: true,
    data: { commandId, status: "sent" }
  });
});

app.get("/commands/:id", (req, res) => {
  const cmd = commands.get(req.params.id);

  if (!cmd) {
    return res.status(404).json({ ok: false, error: "NOT_FOUND" });
  }

  res.json({ ok: true, data: cmd });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on("connection", (ws, req) => {
  const url = new URL(req.url, "http://localhost");

  const agentId = url.searchParams.get("agentId");
  const secret = url.searchParams.get("secret");

  if (secret !== config.agent.secret) {
    ws.close(4001, "unauthorized");
    return;
  }

  if (!agentId) {
    ws.close(4002, "missing agentId");
    return;
  }

  registry.register(agentId, ws);

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    const { valid } = validateMessage(msg);
    if (!valid) return;

    switch (msg.type) {

      case MessageType.HEARTBEAT:
        registry.heartbeat(agentId);
        break;

      case MessageType.SYSTEM_STATE:
        registry.updateSnapshot(agentId, msg.payload);
        break;

      case MessageType.COMMAND_ACK:
        log.info({ agentId }, "command ack");
        break;

      case MessageType.RESPONSE: {
        const { commandId, output, error, status } = msg.payload;

        const cmd = commands.get(commandId);
        if (!cmd) return;

        cmd.status = status;
        cmd.output = output;
        cmd.error = error;

        commands.set(commandId, cmd);
        break;
      }

      default:
        log.warn({ type: msg.type }, "unhandled message");
    }
  });

  ws.on("close", () => registry.deregister(agentId));
});

server.listen(config.coordinator.port, () => {
  log.info({ port: config.coordinator.port }, "coordinator running");
});