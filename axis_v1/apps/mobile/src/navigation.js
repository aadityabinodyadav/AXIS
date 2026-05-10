import React                            from 'react'
import { NavigationContainer }          from '@react-navigation/native'
import { createBottomTabNavigator }     from '@react-navigation/bottom-tabs'
import { createStackNavigator }         from '@react-navigation/stack'
import { Text }                         from 'react-native'
import { AuthScreen }   from './screens/AuthScreen'
import { ForgeScreen }  from './screens/ForgeScreen'
import { ChatScreen }   from './screens/ChatScreen'
import { ScoutScreen }  from './screens/ScoutScreen'
import { theme }        from './theme'

// Update AuthScreen to use useAuth instead of useAxis
// actions.login(token) instead of actions.setToken(token)

const Tab   = createBottomTabNavigator()
const Stack = createStackNavigator()

function MainTabs() {
  return (
    <Tab.Navigator screenOptions={{
      headerStyle:             { backgroundColor: theme.colors.surface },
      headerTintColor:         theme.colors.text,
      tabBarStyle:             { backgroundColor: theme.colors.surface,
                                 borderTopColor: theme.colors.border },
      tabBarActiveTintColor:   theme.colors.accent,
      tabBarInactiveTintColor: theme.colors.textFaint,
    }}>
      <Tab.Screen name="Forge" component={ForgeScreen}
        options={{ tabBarIcon: ({ color }) => <Text style={{ color }}>⚡</Text> }} />
      <Tab.Screen name="Chat"  component={ChatScreen}
        options={{ tabBarIcon: ({ color }) => <Text style={{ color }}>◈</Text> }} />
      <Tab.Screen name="Scout" component={ScoutScreen}
        options={{ tabBarIcon: ({ color }) => <Text style={{ color }}>◎</Text> }} />
    </Tab.Navigator>
  )
}

export function Navigation({ authenticated }) {
  return (
    <NavigationContainer theme={{
      dark: true,
      colors: {
        background:   theme.colors.bg,
        card:         theme.colors.surface,
        text:         theme.colors.text,
        border:       theme.colors.border,
        notification: theme.colors.accent,
        primary:      theme.colors.accent,
      },
    }}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!authenticated
          ? <Stack.Screen name="Auth" component={AuthScreen} />
          : <Stack.Screen name="Main" component={MainTabs} />
        }
      </Stack.Navigator>
    </NavigationContainer>
  )
}