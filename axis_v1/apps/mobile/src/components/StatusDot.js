import React    from 'react'
import { View } from 'react-native'
import { theme } from '../theme'

const COLOR_MAP = {
  connected:    theme.colors.connected,
  stale:        theme.colors.warn,
  disconnected: theme.colors.error,
  unknown:      theme.colors.textFaint,
}

export function StatusDot({ status, size = 8 }) {
  return (
    <View style={{
      width:         size,
      height:        size,
      borderRadius:  size / 2,
      backgroundColor: COLOR_MAP[status] || theme.colors.textFaint,
    }} />
  )
}