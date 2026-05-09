import React, { useEffect } from 'react'
import { StatusBar }        from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { AxisProvider }     from './src/store'
import { Navigation }       from './src/navigation'
import { api } from './src/api/client'
import { CONFIG } from './src/config'

export default function App() {
  useEffect(() => {
    async function ensureToken(){
      try{
        if (CONFIG.DEV_TOKEN === 'AUTO'){
          const res = await fetch(`${CONFIG.GATEWAY_URL}/dev/token`, { method: 'POST' })
          const payload = await res.json()
          if(res.ok && payload?.data?.token){
            await api.setToken(payload.data.token)
            return
          }
        }

        if (CONFIG.DEV_TOKEN){
          await api.setToken(CONFIG.DEV_TOKEN)
        }
      }catch(e){
        // ignore — token fetch is best-effort for dev convenience
      }
    }

    ensureToken()
  }, [])
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AxisProvider>
        <StatusBar style="light" />
        <Navigation />
      </AxisProvider>
    </GestureHandlerRootView>
  )
}