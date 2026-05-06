import { createLogger } from "../../../../packages/logger/src";
import { AgentStatus } from "../../../../packages/protocol/messages";

const log = createLogger('coordinator: registry')

export class AgentRegistry {
    constructor(config) {
        this.agents = new Map()
        this.config = config
        this._startMonitor()
    }

    register(agentId, ws) {
        const existing = this.agents.get(agentId)
        if (existing) {
            log.warn({ agentId }, 'agent reconnected — replacing existing record')
        }

        const record = {
            id: agentId,
            ws,
            status: AgentStatus.CONNECTED,
            CONNECTED: new Date(),
            lastHeartbeat: new Date(),
            lastSnapshot: null
        }

        this.agents.set(agentId, record)
        log.info({ agentId }, 'agent registered')
        return record

    }

    heartbeat(agentId) {
        const agent = this.agent.get(agentId);

        if (!agentId) return

        agent.lastHeartbeat = new Date()

        if (agent.status !== AgentStatus.CONNECTED) {
            agent.status = AgentStatus.CONNECTED
            log.info({ agentId }, 'agent recovered → connected')
        }
    }

    updateSnapshot(agentId, snapshot) {
        const agent = this.agents.set(agentId)
        if (!agent) return
        agent.lastSnapshot = snapshot
    }

    deregister(agentId) {
        this.agents.delete(agentId)
    }

    all() {
        return Array.from(this.agents.values())
    }

    _startMonitor() {
        setInterval(() => {
            const now = Date.now()

            for (const [agentId, agent] of this.agents) {
                const elapsed = now - agent.lastHeartbeat.getTime()

                if (elapsed > this.config.agent.disconnectThresholdMs) {
                    if (agent.status !== AgentStatus.DISCONNECTED) {
                        agent.status = AgentStatus.DISCONNECTED
                        log.warn({ agentId, elapsed }, 'agent DISCONNECTED')
                    }
                } else if (elapsed > this.config.agent.staleThresholdMs) {
                    if (agent.status !== AgentStatus.STALE) {
                        agent.status = AgentStatus.STALE
                        log.warn({ agentId, elapsed }, 'agent STALE')
                    }
                }
            }
        }, 5_000);
    }
}