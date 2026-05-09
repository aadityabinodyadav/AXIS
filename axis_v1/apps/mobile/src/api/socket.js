/**
 * WebSocket Manager
 * Persistent connection for live log streaming.
 * Reconnects automatically. Singleton — one connection.
 */

import AsyncStorage from '@react-native-async-storage/async-storage'
import { CONFIG }   from '../config'

class AxisSocket {
  constructor() {
    this.ws        = null
    this.handlers  = {}
    this.connected = false
    this.attempt   = 0
  }

  async connect() {
    const token = await AsyncStorage.getItem(CONFIG.TOKEN_KEY)
    if (!token) return

    const url = `${CONFIG.WS_URL}/v1/stream?token=${token}`
    this.ws   = new WebSocket(url)

    this.ws.onopen = () => {
      this.connected = true
      this.attempt   = 0
      this._emit('connected')
    }

    this.ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        this._emit(msg.type, msg)
        this._emit('*', msg)      // wildcard — listen to everything
      } catch {}
    }

    this.ws.onclose = () => {
      this.connected = false
      this._emit('disconnected')
      this._reconnect()
    }

    this.ws.onerror = () => {
      // close fires after — handled there
    }
  }

  on(event, handler) {
    if (!this.handlers[event]) this.handlers[event] = []
    this.handlers[event].push(handler)
    return () => this.off(event, handler)   // returns unsubscribe fn
  }

  off(event, handler) {
    this.handlers[event] = (this.handlers[event] || [])
      .filter(h => h !== handler)
  }

  send(type, payload) {
    if (!this.connected) return
    this.ws.send(JSON.stringify({ type, payload }))
  }

  disconnect() {
    if (this.ws) this.ws.close()
  }

  _emit(event, data) {
    ;(this.handlers[event] || []).forEach(h => h(data))
  }

  _reconnect() {
    const delay = Math.min(1000 * Math.pow(2, this.attempt), 30000)
    this.attempt++
    setTimeout(() => this.connect(), delay)
  }
}

export const socket = new AxisSocket()