import React    from 'react'
import { Text } from 'react-native'
import { theme } from '../theme'

export function Label({ children, dim, faint, accent, mono, size, style }) {
  return (
    <Text style={[{
      color:      accent ? theme.colors.accent
                : dim    ? theme.colors.textDim
                : faint  ? theme.colors.textFaint
                :          theme.colors.text,
      fontSize:   size || 14,
      fontFamily: mono ? theme.font.mono : theme.font.sans,
    }, style]}>
      {children}
    </Text>
  )
}