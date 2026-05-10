/**
 * Axis WebSocket Manager
 * - Token in auth frame, never URL
 * - Double-connect guard
 * - Reconnect timer cleared on logout (no leak)
 * - _destroyed flag prevents ghost reconnects
 */

import { api }    from './client'
import { CONFIG } from '../config'

const BACKOFF = { initial: 1000, max: 30000, factor: 2 }

class AxisSocket {
  constructor() {
    this.ws              = null
    this.handlers        = {}
    this.connected       = false
    this.authed          = false
    this.attempt         = 0
    this._connecting     = false
    this._destroyed      = false
    this._reconnectTimer = null    // tracked — cleared on disconnect
  }

  async connect() {
    if (this._destroyed)             return
    if (this._connecting)            return
    if (this.connected && this.authed) return

    this._connecting = true

    const token = await api.getToken()
    if (!token) {
      this._connecting = false
      return
    }

    this._destroySocket()

    this.ws = new WebSocket(`${CONFIG.WS_URL}/v1/stream`)

    this.ws.onopen = () => {
      this._connecting = false
      this.connected   = true
      this.attempt     = 0

      // Auth frame — token never in URL
      this.ws.send(JSON.stringify({
        type:    'AUTH',
        payload: { token },
      }))
    }

    this.ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)

        if (msg.type === 'AUTH_OK') {
          this.authed = true
          this._emit('connected')
          return
        }

        if (msg.type === 'AUTH_FAIL') {
          this._emit('auth_failed')
          this.disconnect()
          return
        }

        if (!this.authed) return

        this._emit(msg.type, msg)
        this._emit('*', msg)
      } catch {}
    }

    this.ws.onclose = (e) => {
      this.connected   = false
      this.authed      = false
      this._connecting = false
      this._emit('disconnected', { code: e.code })

      // Only reconnect if not intentionally destroyed
      if (!this._destroyed) this._scheduleReconnect()
    }

    this.ws.onerror = () => {
      // onclose fires after — handled there
    }
  }

  on(event, handler) {
    if (!this.handlers[event]) this.handlers[event] = []
    this.handlers[event].push(handler)
    return () => this.off(event, handler)
  }

  off(event, handler) {
    this.handlers[event] = (this.handlers[event] || [])
      .filter(h => h !== handler)
  }

  send(type, payload) {
    if (!this.connected || !this.authed) return
    if (this.ws?.readyState !== WebSocket.OPEN) return
    this.ws.send(JSON.stringify({ type, payload }))
  }

  disconnect() {
    this._destroyed = true

    // Clear pending reconnect timer — no ghost reconnects after logout
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer)
      this._reconnectTimer = null
    }

    this._destroySocket()
  }

  // Called when app comes back to foreground
  resume() {
    if (this._destroyed) return
    this._destroyed = false
    this.connect()
  }

  _scheduleReconnect() {
    if (this._destroyed) return   // guard — never reconnect after logout

    const delay = Math.min(
      BACKOFF.initial * Math.pow(BACKOFF.factor, this.attempt),
      BACKOFF.max
    )
    this.attempt++

    this._reconnectTimer = setTimeout(() => {
      if (!this._destroyed) this.connect()
    }, delay)
  }

  _destroySocket() {
    if (!this.ws) return
    try {
      this.ws.onopen    = null
      this.ws.onmessage = null
      this.ws.onclose   = null
      this.ws.onerror   = null
      if (this.ws.readyState === WebSocket.OPEN ||
          this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close()
      }
    } catch {}
    this.ws        = null
    this.connected = false
    this.authed    = false
  }

  _emit(event, data) {
    ;(this.handlers[event] || []).forEach(h => {
      try { h(data) } catch {}
    })
  }
}

export const socket = new AxisSocket()