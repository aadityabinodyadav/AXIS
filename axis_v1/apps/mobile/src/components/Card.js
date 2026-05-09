import React    from 'react'
import { View } from 'react-native'
import { theme } from '../theme'

export function Card({ children, style }) {
  return (
    <View style={[{
      backgroundColor: theme.colors.surface,
      borderRadius:    theme.radius.md,
      borderWidth:     1,
      borderColor:     theme.colors.border,
      padding:         theme.space.md,
      marginBottom:    theme.space.sm,
    }, style]}>
      {children}
    </View>
  )
}