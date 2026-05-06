/**
 * Agent Transport Layer
 * Manages WebSocket connection to coordinator.
 * Handles reconnection with exponential backoff.
 * The agent never gives up connecting — it just waits longer.
 */

import WebSocket from 'ws'
import { createLogger } from '../../../packages/logger/src/index.js'
import { buildMessage, MessageType } from '../../../packages/protocol/messages.js'

const log = createLogger('agent:transport')

const BACKOFF = {
  initial:  1000,   // 1s
  max:      30000,  // 30s cap
  factor:   2,
}

export class AgentConnection {
  constructor(config) {
    this.config      = config
    this.ws          = null
    this.attempt     = 0
    this.connected   = false
    this.handlers    = {}        // message type → handler fn
    this._heartbeatTimer = null
  }

  /**
   * Register a handler for incoming message types.
   */
  on(type, handler) {
    this.handlers[type] = handler
    return this
  }

  /**
   * Connect to coordinator. Retries forever on failure.
   */
  connect() {
    const url = `${this.config.coordinatorUrl}?` +
      `agentId=${this.config.id}&secret=${this.config.secret}`

    log.info({ url: this.config.coordinatorUrl, attempt: this.attempt + 1 },
      'connecting to coordinator')

    this.ws = new WebSocket(url)

    this.ws.on('open', () => {
      this.connected = true
      this.attempt   = 0
      log.info('connected to coordinator')
      this._startHeartbeat()
    })

    this.ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw)
        const handler = this.handlers[msg.type]
        if (handler) handler(msg)
        else log.warn({ type: msg.type }, 'no handler for message type')
      } catch (err) {
        log.error({ err }, 'failed to parse incoming message')
      }
    })

    this.ws.on('close', (code, reason) => {
      this.connected = false
      this._stopHeartbeat()
      log.warn({ code, reason: reason.toString() }, 'disconnected from coordinator')
      this._scheduleReconnect()
    })

    this.ws.on('error', (err) => {
      log.error({ err: err.message }, 'websocket error')
      // close event will fire after this — reconnect handled there
    })
  }

  /**
   * Send a typed message to coordinator.
   */
  send(type, payload = {}) {
    if (!this.connected || this.ws.readyState !== 1) {
      log.warn({ type }, 'attempted send while disconnected — dropped')
      return false
    }
    const msg = buildMessage(type, 'agent', payload)
    this.ws.send(JSON.stringify(msg))
    return true
  }

  _startHeartbeat() {
    this._heartbeatTimer = setInterval(() => {
      this.send(MessageType.HEARTBEAT, {
        agentId: this.config.id,
        uptime:  process.uptime(),
      })
    }, this.config.heartbeatMs)
  }

  _stopHeartbeat() {
    if (this._heartbeatTimer) {
      clearInterval(this._heartbeatTimer)
      this._heartbeatTimer = null
    }
  }

  _scheduleReconnect() {
    const delay = Math.min(
      BACKOFF.initial * Math.pow(BACKOFF.factor, this.attempt),
      BACKOFF.max
    )
    this.attempt++
    log.info({ delay, attempt: this.attempt }, 'reconnecting in...')
    setTimeout(() => this.connect(), delay)
  }
}

