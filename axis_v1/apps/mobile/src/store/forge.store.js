/**
 * Forge Store
 * - True ring buffer — mutates in place, no O(n) copy on every log line
 * - Polls system state every 30s
 * - Subscribes to live log stream via WebSocket
 */

import { createContext, useContext,
         useReducer, useEffect, useRef } from 'react'
import { api }    from '../api/client'
import { socket } from '../api/socket'

const ForgeContext   = createContext(null)
const LOG_BUFFER_SIZE = 200

function makeLogBuffer() {
  return new Array(LOG_BUFFER_SIZE).fill(null)
}

const initial = {
  agentStatus: 'unknown',
  systemState: null,
  logs:        makeLogBuffer(),
  logHead:     0,
  logCount:    0,
  loading:     false,
  error:       null,
}

function reducer(state, action) {
  switch (action.type) {

    case 'SET_STATE':
      return {
        ...state,
        systemState: action.data,
        agentStatus: action.data?.agents?.[0]?.status || 'unknown',
        loading:     false,
        error:       null,
      }

    case 'APPEND_LOG': {
      // True ring buffer — mutate in place, no spread
      // This is one of the rare correct uses of mutation in a reducer
      const idx = state.logHead % LOG_BUFFER_SIZE
      state.logs[idx] = action.line
      return {
        ...state,
        logs:     state.logs,   // same reference — intentional
        logHead:  state.logHead  + 1,
        logCount: state.logCount + 1,
      }
    }

    case 'SET_LOADING': return { ...state, loading: action.value }
    case 'SET_ERROR':   return { ...state, error: action.error, loading: false }
    case 'CLEAR_ERROR': return { ...state, error: null }
    default:            return state
  }
}

export function ForgeProvider({ children, authenticated }) {
  const [state, dispatch] = useReducer(reducer, initial)
  const pollRef           = useRef(null)

  // Poll system state every 30s
  useEffect(() => {
    if (!authenticated) return

    const refresh = async () => {
      try {
        const data = await api.get('/v1/state')
        dispatch({ type: 'SET_STATE', data })
      } catch (err) {
        dispatch({ type: 'SET_ERROR', error: err.message })
      }
    }

    refresh()
    pollRef.current = setInterval(refresh, 30_000)
    return () => clearInterval(pollRef.current)
  }, [authenticated])

  // Live log stream from WebSocket
  useEffect(() => {
    if (!authenticated) return
    return socket.on('LOG_STREAM', (msg) => {
      dispatch({ type: 'APPEND_LOG', line: msg.payload })
    })
  }, [authenticated])

  /**
   * Returns logs in chronological order.
   * Slices the ring buffer correctly regardless of wrap state.
   */
  function getLogsOrdered() {
    const { logs, logHead, logCount } = state
    if (logCount === 0) return []
    if (logCount < LOG_BUFFER_SIZE) {
      return logs.slice(0, logCount).filter(Boolean)
    }
    // Buffer full — read from oldest (logHead) to newest
    const start = logHead % LOG_BUFFER_SIZE
    return [
      ...logs.slice(start),
      ...logs.slice(0, start),
    ].filter(Boolean)
  }

  const actions = {
    refresh: async () => {
      dispatch({ type: 'SET_LOADING', value: true })
      try {
        const data = await api.get('/v1/state')
        dispatch({ type: 'SET_STATE', data })
      } catch (err) {
        dispatch({ type: 'SET_ERROR', error: err.message })
      }
    },

    sendCommand: (action, params) =>
      api.post('/v1/commands', { action, params }),

    clearError:      () => dispatch({ type: 'CLEAR_ERROR' }),
    getLogsOrdered,
  }

  return (
    <ForgeContext.Provider value={{ state, actions }}>
      {children}
    </ForgeContext.Provider>
  )
}

export const useForge = () => useContext(ForgeContext)