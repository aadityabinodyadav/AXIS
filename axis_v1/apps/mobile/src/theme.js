/**
 * Axis Design System
 * Dark, sharp, technical. Feels like a tool, not a toy.
 */

export const theme = {
  colors: {
    bg:          '#0A0A0A',    // near black
    surface:     '#111111',    // cards, panels
    surfaceHigh: '#1A1A1A',    // elevated surfaces
    border:      '#222222',    // subtle borders
    accent:      '#00FF88',    // Axis green — primary action
    accentDim:   '#00FF8820',  // accent with opacity
    warn:        '#FFB800',    // warnings
    error:       '#FF4444',    // errors, critical
    text:        '#F0F0F0',    // primary text
    textDim:     '#888888',    // secondary text
    textFaint:   '#444444',    // very muted
    connected:   '#00FF88',
    stale:       '#FFB800',
    disconnected:'#FF4444',
  },
  font: {
    mono:    'SpaceMono',      // for logs, code, system data
    sans:    'System',         // for UI text
  },
  space: {
    xs: 4, sm: 8, md: 16, lg: 24, xl: 32
  },
  radius: {
    sm: 6, md: 12, lg: 20
  },
}