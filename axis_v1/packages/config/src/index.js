
export function getConfig() {
  const required = (key) => {
    const val = process.env[key]
    if (!val) throw new Error(`Missing required env var: ${key}`)
    return val
  }

  const optional = (key, fallback) => process.env[key] || fallback

  return {
    env: optional('NODE_ENV', 'development'),

    agent: {
      id:              optional('AGENT_ID', 'default-agent'),
      secret:          optional('AGENT_SECRET', 'dev-secret-change-in-prod'),
      coordinatorUrl:  optional('COORDINATOR_URL', 'ws://localhost:3001'),
      heartbeatMs:     parseInt(optional('HEARTBEAT_INTERVAL_MS', '5000')),
      staleThresholdMs:    15000,
      disconnectThresholdMs: 60000,
    },

    coordinator: {
      port: parseInt(optional('COORDINATOR_PORT', '3001')),
    },

    gateway: {
      port: parseInt(optional('GATEWAY_PORT', '3000')),
      jwtSecret: optional('JWT_SECRET', 'dev-jwt-secret-change-in-prod'),
    },

    db: {
      dir: optional('DB_DIR', './data'),
    }
  }
}

