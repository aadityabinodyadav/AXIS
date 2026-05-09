/**
 * Axis App State
 * Simple React context — no Redux needed at this scale.
 * Holds: system state, agent status, active session, jobs digest.
 */

import React, {
  createContext, useContext,
  useReducer, useEffect
} from 'react'
import { api }    from '../api/client'
import { socket } from '../api/socket'

const AxisContext = createContext(null)

const initialState = {
  // Auth
  token:        null,
  authenticated: false,

  // Agent / Forge
  agentStatus:  'unknown',   // connected | stale | disconnected | unknown
  systemState:  null,
  logs:         [],           // ring buffer — last 200 lines

  // Scout
  digest:       null,
  digestLoading: false,

  // UI
  loading:      false,
  error:        null,
}

function reducer(state, action) {
  switch (action.type) {
    case 'SET_AUTH':
      return { ...state, authenticated: true, token: action.token }

    case 'SET_SYSTEM_STATE':
      return {
        ...state,
        systemState: action.state,
        agentStatus: action.state?.agents?.[0]?.status || 'unknown',
      }

    case 'APPEND_LOG':
      return {
        ...state,
        logs: [...state.logs.slice(-199), action.line],  // keep last 200
      }

    case 'SET_DIGEST':
      return { ...state, digest: action.digest, digestLoading: false }

    case 'SET_DIGEST_LOADING':
      return { ...state, digestLoading: true }

    case 'SET_ERROR':
      return { ...state, error: action.error, loading: false }

    case 'CLEAR_ERROR':
      return { ...state, error: null }

    case 'SET_LOADING':
      return { ...state, loading: action.loading }

    default:
      return state
  }
}

export function AxisProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState)

  // Refresh system state every 30s when authenticated
  useEffect(() => {
    if (!state.authenticated) return

    const refresh = async () => {
      try {
        const data = await api.get('/v1/state')
        dispatch({ type: 'SET_SYSTEM_STATE', state: data })
      } catch {}
    }

    refresh()
    const interval = setInterval(refresh, 30_000)
    return () => clearInterval(interval)
  }, [state.authenticated])

  // WebSocket live events
  useEffect(() => {
    if (!state.authenticated) return

    socket.connect()

    const unsubLog = socket.on('LOG_STREAM', (msg) => {
      dispatch({ type: 'APPEND_LOG', line: msg.payload })
    })

    return () => {
      unsubLog()
      socket.disconnect()
    }
  }, [state.authenticated])

  const actions = {
    setToken: async (token) => {
      await api.setToken(token)
      dispatch({ type: 'SET_AUTH', token })
    },

    refreshState: async () => {
      try {
        const data = await api.get('/v1/state')
        dispatch({ type: 'SET_SYSTEM_STATE', state: data })
      } catch (err) {
        dispatch({ type: 'SET_ERROR', error: err.message })
      }
    },

    sendCommand: async (action, params) => {
      return api.post('/v1/commands', { action, params })
    },

    chat: async (message, sessionId) => {
      return api.post('/v1/chat', { message, sessionId })
    },

    loadDigest: async () => {
      dispatch({ type: 'SET_DIGEST_LOADING' })
      try {
        const data = await api.get('/v1/digest/latest')
        dispatch({ type: 'SET_DIGEST', digest: data })
      } catch (err) {
        dispatch({ type: 'SET_ERROR', error: err.message })
      }
    },

    clearError: () => dispatch({ type: 'CLEAR_ERROR' }),
  }

  return (
    <AxisContext.Provider value={{ state, actions }}>
      {children}
    </AxisContext.Provider>
  )
}

export const useAxis = () => useContext(AxisContext)