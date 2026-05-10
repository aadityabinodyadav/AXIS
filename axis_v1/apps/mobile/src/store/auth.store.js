/**
 * Auth Store
 * - hydrated flag prevents UI flash before token check
 * - Navigation renders null until hydration complete
 */

import { createContext, useContext, useReducer } from 'react'
import { api } from '../api/client'

const AuthContext = createContext(null)

const initial = {
  authenticated: false,
  token:         null,
  hydrated:      false,   // false = still checking SecureStore
}

function reducer(state, action) {
  switch (action.type) {
    case 'HYDRATED':
      return {
        ...state,
        ...action.payload,
        hydrated: true,
      }
    case 'LOGIN':
      return { ...state, authenticated: true, token: action.token }
    case 'LOGOUT':
      return { ...state, authenticated: false, token: null }
    default:
      return state
  }
}

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initial)

  const actions = {
    // Check SecureStore on cold start — sets hydrated when done
    hydrate: async () => {
      const token = await api.getToken()
      dispatch({
        type:    'HYDRATED',
        payload: token
          ? { authenticated: true,  token }
          : { authenticated: false, token: null },
      })
    },

    login: async (token) => {
      await api.setToken(token)
      dispatch({ type: 'LOGIN', token })
    },

    logout: async () => {
      await api.clearToken()
      dispatch({ type: 'LOGOUT' })
    },
  }

  return (
    <AuthContext.Provider value={{ state, actions }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)