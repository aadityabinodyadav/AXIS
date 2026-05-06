import { createLogger } from "../../../../packages/logger/src/index.js";
import { CommandStatus } from "../../../../packages/protocol/messages.js";

const log = createLogger("coordinator, command: queue")

const COMMAND_TIMEOUT_MS = 30_000

export class CommandQueue {
    constructor() {
        this.commands = new Map();
    }

    enqueue(commandId, agentId, action, params) {
        const record = {
            id: commandId,
            agentId,
            action,
            params,
            status: CommandStatus.PENDING,
            createdAt: new Date(),
            ackedAt: null,
            resolvedAt: null,
            output: null,
            error: null,
            _resolve: null,
            _reject: null,
        }

        this.commands.set(commandId, record)

        setTimeout(() => {
            const cmd = this.commands.get(commandId)
            if (cmd && cmd.status !== CommandStatus.SUCCESS
                && cmd.status !== CommandStatus.FAILED) {
                log.warn({ commandId, action }, 'command TIMEOUT')
                cmd.status = CommandStatus.TIMEOUT
                cmd.resolvedAt = new Date()
                if (cmd._reject) cmd._reject(new Error('command timed out'))
            }
        }, COMMAND_TIMEOUT_MS)

        return record
    }

    waitForResponse(commandId) {
        const record = this.commands.get(commandId)
        if (!record) return Promise.reject(new Error('command not found'))

        return new Promise((resolve, reject) => {
            record._resolve = resolve
            record._reject = reject
        })
    }

    markSent(command){
        this._transition(commandId, CommandStatus.SENT)
    }

    markAcked(commandId) {
    const record = this._transition(commandId, CommandStatus.ACKED)
    if (record) record.ackedAt = new Date()
  }

resolve(commandId, status, output, error) {
    const record = this.commands.get(commandId)
    if (!record) return

    record.status     = status
    record.output     = output
    record.error      = error
    record.resolvedAt = new Date()

    log.info({ commandId, status }, 'command resolved')

    if (status === CommandStatus.SUCCESS && record._resolve)
      record._resolve({ output })
    else if (record._reject)
      record._reject(new Error(error || 'command failed'))
  }

    get(commandId) {
    return this.commands.get(commandId)
  }

  _transition(commandId, newStatus) {
    const record = this.commands.get(commandId)
    if (!record) return null
    log.debug({ commandId, from: record.status, to: newStatus }, 'status transition')
    record.status = newStatus
    return record
  }
}