/**
 * Axis API Client
 * - SecureStore for tokens
 * - 15s AbortController timeout on every request
 * - Safe JSON parsing — never crashes on bad response
 */

import * as SecureStore from 'expo-secure-store'
import { CONFIG }       from '../config'

const TOKEN_KEY     = 'axis.token'
const TIMEOUT_MS    = 15_000

async function getToken()        { return SecureStore.getItemAsync(TOKEN_KEY) }
async function setToken(token)   { return SecureStore.setItemAsync(TOKEN_KEY, token) }
async function clearToken()      { return SecureStore.deleteItemAsync(TOKEN_KEY) }

async function request(method, path, body = null) {
  const token      = await getToken()
  const controller = new AbortController()
  const timer      = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const response = await fetch(`${CONFIG.GATEWAY_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body:   body ? JSON.stringify(body) : null,
      signal: controller.signal,
    })

    // Safe JSON parse — never crash on bad server response
    let data = null
    try {
      data = await response.json()
    } catch {
      throw new Error('Invalid server response')
    }

    if (!response.ok || !data?.ok) {
      throw new Error(data?.error?.message || `HTTP ${response.status}`)
    }

    return data.data

  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Request timed out')
    throw err
  } finally {
    clearTimeout(timer)
  }
}

export const api = {
  get:        (path)       => request('GET',    path),
  post:       (path, body) => request('POST',   path, body),
  delete:     (path)       => request('DELETE', path),
  setToken,
  getToken,
  clearToken,
}