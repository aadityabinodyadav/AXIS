/**
 * Axis App Root
 * - Waits for auth hydration before rendering navigation
 *   (prevents login UI flash on cold start)
 * - AppState listener reconnects socket on app resume
 * - Logout disconnects socket cleanly
 */

import React, { useEffect }        from 'react'
import { AppState, View }          from 'react-native'
import { StatusBar }               from 'expo-status-bar'
import { GestureHandlerRootView }  from 'react-native-gesture-handler'
import { AuthProvider, useAuth }   from './src/store/auth.store'
import { ForgeProvider }           from './src/store/forge.store'
import { ScoutProvider }           from './src/store/scout.store'
import { ChatProvider }            from './src/store/chat.store'
import { Navigation }              from './src/navigation'
import { socket }                  from './src/api/socket'
import { theme }                   from './src/theme'

function AppInner() {
  const { state, actions } = useAuth()

  // Cold start — check SecureStore for existing token
  useEffect(() => { actions.hydrate() }, [])

  // Connect / disconnect socket on auth state change
  useEffect(() => {
    if (state.authenticated) {
      socket.resume()
    } else {
      socket.disconnect()
    }
  }, [state.authenticated])

  // Reconnect socket when app comes back to foreground
  // Critical for mobile — socket dies silently in background
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && state.authenticated) {
        socket.resume()
      }
    })
    return () => sub.remove()
  }, [state.authenticated])

  // Block render until hydration complete
  // Prevents flash of login screen on returning users
  if (!state.hydrated) {
    return (
      <View style={{
        flex: 1,
        backgroundColor: theme.colors.bg
      }} />
    )
  }

  return (
    <ForgeProvider authenticated={state.authenticated}>
      <ScoutProvider>
        <ChatProvider>
          <Navigation authenticated={state.authenticated} />
        </ChatProvider>
      </ScoutProvider>
    </ForgeProvider>
  )
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
      <AuthProvider>
        <AppInner />
      </AuthProvider>
    </GestureHandlerRootView>
  )
}