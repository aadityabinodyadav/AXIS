export const MessageType = {
  // Lifecycle
  HEARTBEAT:        'HEARTBEAT',
  PROBE:            'PROBE',
  PROBE_ACK:        'PROBE_ACK',

  // System observation
  SYSTEM_STATE:     'SYSTEM_STATE',
  EVENT:            'EVENT',
  LOG_STREAM:       'LOG_STREAM',

  // Control
  COMMAND:          'COMMAND',
  COMMAND_ACK:      'COMMAND_ACK',
  RESPONSE:         'RESPONSE',

  // Intelligence
  CHAT:             'CHAT',
  CHAT_RESPONSE:    'CHAT_RESPONSE',

  // Internal
  ERROR:            'ERROR',
}

export const EventSeverity = {
  CRITICAL: 'critical',
  WARN:     'warn',
  INFO:     'info',
}

export const AgentStatus = {
  CONNECTED:    'connected',
  STALE:        'stale',       // no heartbeat > 15s
  DISCONNECTED: 'disconnected' // no heartbeat > 60s
}

export const CommandStatus = {
  PENDING:   'pending',
  SENT:      'sent',
  ACKED:     'acked',
  SUCCESS:   'success',
  FAILED:    'failed',
  TIMEOUT:   'timeout',
}

export function buildMessage(type, source, payload = {}){
   return { 
    id: crypto.randomUUID(),
    type,
    source,
    timestamp: new Date().toISOString(),
    payload,
    }
}

export function validateMessage(msg) {
  if (!msg || typeof msg !== 'object')
    return { valid: false, reason: 'message must be an object' }
  if (!msg.id)
    return { valid: false, reason: 'missing id' }
  if (!msg.type || !Object.values(MessageType).includes(msg.type))
    return { valid: false, reason: `unknown type: ${msg.type}` }
  if (!msg.source)
    return { valid: false, reason: 'missing source' }
  if (!msg.timestamp)
    return { valid: false, reason: 'missing timestamp' }
  return { valid: true, reason: null }
}

