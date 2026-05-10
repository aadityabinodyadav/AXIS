/**
 * Chat Store
 * - Messages capped at 100 — no unbounded memory growth
 * - Voice mode flag lives here
 * - Session ID consistent per device session
 */

import { createContext, useContext, useReducer } from 'react'
import { api } from '../api/client'

const ChatContext  = createContext(null)
const SESSION_ID   = 'mobile-session'
const MAX_MESSAGES = 100

const initial = {
  messages:  [{ role: 'assistant', content: 'Axis online. What do you need?' }],
  loading:   false,
  voiceMode: false,
  error:     null,
}

function reducer(state, action) {
  switch (action.type) {

    case 'ADD_MESSAGE': {
      const updated = [...state.messages, action.message]
      return {
        ...state,
        // Trim from the front — keep the most recent MAX_MESSAGES
        messages: updated.slice(-MAX_MESSAGES),
      }
    }

    case 'SET_LOADING':  return { ...state, loading:   action.value }
    case 'TOGGLE_VOICE': return { ...state, voiceMode: !state.voiceMode }
    case 'SET_ERROR':    return { ...state, error: action.error, loading: false }
    case 'CLEAR_ERROR':  return { ...state, error: null }
    default:             return state
  }
}

export function ChatProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initial)

  const actions = {
    send: async (text) => {
      if (!text.trim() || state.loading) return null

      dispatch({ type: 'ADD_MESSAGE',
        message: { role: 'user', content: text } })
      dispatch({ type: 'SET_LOADING', value: true })

      try {
        const data  = await api.post('/v1/chat',
          { message: text, sessionId: SESSION_ID })
        const reply = data.reply

        dispatch({ type: 'ADD_MESSAGE',
          message: { role: 'assistant', content: reply } })
        dispatch({ type: 'SET_LOADING', value: false })

        return reply   // caller handles TTS

      } catch (err) {
        dispatch({ type: 'ADD_MESSAGE',
          message: {
            role:    'assistant',
            content: `Error: ${err.message}`,
            error:   true,
          }
        })
        dispatch({ type: 'SET_ERROR', error: err.message })
        return null
      }
    },

    toggleVoice: () => dispatch({ type: 'TOGGLE_VOICE' }),
    clearError:  () => dispatch({ type: 'CLEAR_ERROR' }),
  }

  return (
    <ChatContext.Provider value={{ state, actions }}>
      {children}
    </ChatContext.Provider>
  )
}

export const useChat = () => useContext(ChatContext)