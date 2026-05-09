import React                   from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createStackNavigator }     from '@react-navigation/stack'
import { Text }                from 'react-native'
import { useAxis }             from './store'
import { AuthScreen }          from './screens/AuthScreen'
import { ForgeScreen }         from './screens/ForgeScreen'
import { ChatScreen }          from './screens/ChatScreen'
import { ScoutScreen }         from './screens/ScoutScreen'
import { theme }               from './theme'

const Tab   = createBottomTabNavigator()
const Stack = createStackNavigator()

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle:      { backgroundColor: theme.colors.surface },
        headerTintColor:  theme.colors.text,
        tabBarStyle:      { backgroundColor: theme.colors.surface,
                            borderTopColor: theme.colors.border },
        tabBarActiveTintColor:   theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.textFaint,
      }}
    >
      <Tab.Screen
        name="Forge"
        component={ForgeScreen}
        options={{ tabBarIcon: ({ color }) => <Text style={{ color }}>⚡</Text> }}
      />
      <Tab.Screen
        name="Chat"
        component={ChatScreen}
        options={{ tabBarIcon: ({ color }) => <Text style={{ color }}>◈</Text> }}
      />
      <Tab.Screen
        name="Scout"
        component={ScoutScreen}
        options={{ tabBarIcon: ({ color }) => <Text style={{ color }}>◎</Text> }}
      />
    </Tab.Navigator>
  )
}

export function Navigation() {
  const { state } = useAxis()

  return (
    <NavigationContainer theme={{
      colors: {
        background: theme.colors.bg,
        card:       theme.colors.surface,
        text:       theme.colors.text,
        border:     theme.colors.border,
        notification: theme.colors.accent,
        primary:    theme.colors.accent,
      },
      // Provide a minimal `fonts` mapping because some navigation
      // header components expect `theme.fonts.bold` to exist.
      fonts: {
        bold:    { fontFamily: theme.font.sans, fontWeight: '700' },
        regular: { fontFamily: theme.font.sans, fontWeight: '400' },
      },
      dark: true,
    }}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!state.authenticated ? (
          <Stack.Screen name="Auth" component={AuthScreen} />
        ) : (
          <Stack.Screen name="Main" component={MainTabs} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  )
}