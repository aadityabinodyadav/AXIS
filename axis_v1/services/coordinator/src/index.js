import { getConfig } from "../../../packages/config/src";
import { createLogger } from "../../../packages/logger/src";
import http, { WebSocket } from 'http';
import express, { raw } from "express"
import { AgentRegistry } from "./agent/registry";
import { WebSocketServer } from "ws";
import { MessageType, validateMessage } from "../../../packages/protocol/messages";

const log = createLogger('coordinator')
const config = getConfig();
const registry = new AgentRegistry(config);

const app = express()
app.use(express.json())

app.get('/health', (req,res)=>{
    res.json({
        ok: true,
        data: {service: 'coordinator'}
    })
})

app.get('/state', (req,res) =>{
    const agents = registry.all().map(a=>({
        id: a.id,
        status: a.status,
        connectedAt: a.connectedAt,
        lastHearbeat: a.lastHearbeat,
        snapshot: a.lastSnapshot
    }))

    res.json({
        ok: true,
        data: { agents }
    })
})

const server = http.createServer(app);
const wss = new WebSocketServer({server})

wss.on('connection', (ws,res)=>{
    const url = new URL(req.url, 'http://localhost')
    const agentId = url.searchParams.get('agentId');
    const secret = url.searchParams.get('secret');

    if(secret !== config.agent.secret){
        log.warn({agentId}, 'agent rejected- bad secret')
        ws.close(4001, 'unauthorized')
        return
    }

    if(!agentId){
        ws.close(4002, 'missing agentId')
        return
    }

    const agent = registry.register(agentId, ws)

    ws.on('message'), (raw) => {
        msg = JSON.parse(raw)
        const {valid, reason} = validateMessage(msg)

        if(!valid){
            log.warn({reason},'invalid message dropped')
            return
        }

        switch(msg.type) {
            case MessageType.HEARTBEAT:
                registry.heartbeat(agentId)
                break
            
            case MessageType.SYSTEM_STATE:
                registry.updateSnapshot(agent, msg.payload)
                break

            case MessageType.PROBE_ACK:
                log.info(
                    {agentId, probeId: msg.payload.probeId},
                    'probe ack received'
                )
                break
            
                  case MessageType.COMMAND_ACK:
        log.info(
          { agentId, commandId: msg.payload.commandId },
          'command acked'
        )
        break

      default:
        log.warn({ type: msg.type }, 'unhandled message type')
    }

        }
    
   ws.on('close', () => {
    registry.deregister(agentId)
  })

  ws.on('error', (err) => {
    log.error({ err: err.message, agentId }, 'websocket error')
  })
})

 


server.listen(config.coordinator.port, ()=>{
    log.info(
        {port: config.coordinator.port },
        'coordinator listening'
    )
})


process.on('SIGINT', ()=>{
    log.info('shutting down coordinator')
    process.exit(0)
})