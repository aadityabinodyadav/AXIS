import "dotenv/config"
import { createLogger } from "../../../packages/logger/src/index.js"
import {start} from './scheduler/index.js'
import { EventEmitter } from 'events'

// Increase default listeners to avoid MaxListenersExceededWarning in dev
EventEmitter.defaultMaxListeners = Math.max(EventEmitter.defaultMaxListeners, 20)

const log = createLogger('scout')

log.info('axis scout starting')

start()

import './api/index.js'

function registerExitHandler(name, handler) {
  process._registeredExitHandlers = process._registeredExitHandlers || new Set()
  if (process._registeredExitHandlers.has(name)) return
  process._registeredExitHandlers.add(name)
  process.on('SIGINT', handler)
}

registerExitHandler('scout', () => {
  log.info('shutting down scout')
  process.exit(0)
})
