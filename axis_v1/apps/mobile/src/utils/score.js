/**
 * Score display utilities
 * Scout ranking display logic — not in components.
 */

import { theme } from '../theme'

export function scoreColor(score) {
  if (score >= 8) return theme.colors.accent
  if (score >= 6) return theme.colors.warn
  return theme.colors.textDim
}

export function scoreLabel(score) {
  if (score >= 8) return '🔥'
  if (score >= 6) return '⚡'
  return '👀'
}