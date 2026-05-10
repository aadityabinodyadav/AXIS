/**
 * Scout Store
 * Owns: digest, job list, saved jobs.
 * Scout UI reads only from here.
 */

import { createContext, useContext, useReducer } from 'react'
import { api } from '../api/client'

const ScoutContext = createContext(null)

const initial = {
  digest:  null,
  jobs:    [],
  loading: false,
  error:   null,
}

function reducer(state, action) {
  switch (action.type) {
    case 'SET_DIGEST':  return { ...state, digest: action.data, loading: false }
    case 'SET_JOBS':    return { ...state, jobs: action.data,   loading: false }
    case 'SET_LOADING': return { ...state, loading: action.value }
    case 'SET_ERROR':   return { ...state, error: action.error,  loading: false }
    case 'CLEAR_ERROR': return { ...state, error: null }
    default:            return state
  }
}

export function ScoutProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initial)

  const actions = {
    loadDigest: async () => {
      dispatch({ type: 'SET_LOADING', value: true })
      try {
        const data = await api.get('/v1/digest/latest')
        dispatch({ type: 'SET_DIGEST', data })
      } catch (err) {
        dispatch({ type: 'SET_ERROR', error: err.message })
      }
    },

    loadJobs: async (minScore = 6) => {
      dispatch({ type: 'SET_LOADING', value: true })
      try {
        const data = await api.get(`/v1/jobs?min_score=${minScore}`)
        dispatch({ type: 'SET_JOBS', data: data.jobs })
      } catch (err) {
        dispatch({ type: 'SET_ERROR', error: err.message })
      }
    },

    runPipeline: async () => {
      try {
        await api.post('/v1/scout/run')
      } catch (err) {
        dispatch({ type: 'SET_ERROR', error: err.message })
      }
    },

    saveJob: (jobId, notes) =>
      api.post(`/v1/jobs/${jobId}/save`, { notes }),

    clearError: () => dispatch({ type: 'CLEAR_ERROR' }),
  }

  return (
    <ScoutContext.Provider value={{ state, actions }}>
      {children}
    </ScoutContext.Provider>
  )
}

export const useScout = () => useContext(ScoutContext)