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

process.on('SIGINT', () => {
  log.info('shutting down scout')
  process.exit(0)
})
