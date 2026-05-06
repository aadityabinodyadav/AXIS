import { getConfig } from "../../packages/config/src";
import { createLogger } from "../../packages/logger/src";
import { MessageType } from "../../packages/protocol/messages";
import { getSnapShot } from "./observer/system";
import { AgentConnection } from "./transport/connection";

const log = createLogger('agent')
const config = getConfig()

log.info(
    {agentId: config.agent.id},
    'axis agent starting'
)

const conn = new AgentConnection(config.agent)

conn.on(MessageType.PROBE, (msg)=>{
    log.info({probeId: msg.id}, 'probe recieved - sending ack')
    conn.send(MessageType.PROBE_ACK, {
        probeId: msg.id,
        agentId: config.agent.id,
    })
})

conn.on(MessageType.COMMAND,(msg)=>{
  log.info({ commandId: msg.id, action: msg.payload.action }, 'command received')
  conn.send(MessageType.COMMAND_ACK,{
    commandId: msg.id,
    status: 'acked'
  })
})

setInterval(()=>{
    if(!conn.connected) return
    const snapshot = new getSnapShot()
    conn.send(MessageType.SYSTEM_STATE, snapshot)
    log.debug('system state sent')
},30_000)

conn.connect()

process.on('SIGINT',()=>{
    log.info('shutting down agent')
    process.exit(0)
})




