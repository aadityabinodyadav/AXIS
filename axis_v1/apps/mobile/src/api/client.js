import AsyncStorage from "@react-native-async-storage/async-storage"
import { CONFIG } from "../config"

async function getToken(){
    return AsyncStorage.getItem(CONFIG.TOKEN_KEY)
}

async function request(method, path, body = null){
  const token = await getToken()

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? {'Authorization': `Bearer ${token}`} : {})
  }

  const response = await fetch(`${CONFIG.GATEWAY_URL}${path}`,{
    method,
    headers,
    body: body ? JSON.stringify(body) : null,
  })

  const data = await response.json()

  if(!response.ok || !data.ok){
    throw new Error(data.error?.message || `HTTP ${response.status}`)
  }

  return data.data
}

export const api = {
  get:    (path)         => request('GET', path),
  post:   (path, body)   => request('POST', path, body),
  delete: (path)         => request('DELETE', path),

  setToken: (token) => AsyncStorage.setItem(CONFIG.TOKEN_KEY, token),
  getToken,
  clearToken: () => AsyncStorage.removeItem(CONFIG.TOKEN_KEY),
}