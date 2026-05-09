import React, { useCallback }           from 'react'
import { View, ScrollView, RefreshControl,
         TouchableOpacity, StyleSheet, Text } from 'react-native'
import { useAxis }    from '../store'
import { Card }       from '../components/Card'
import { Label }      from '../components/Label'
import { StatusDot }  from '../components/StatusDot'
import { theme }      from '../theme'

export function ForgeScreen({ navigation }) {
  const { state, actions } = useAxis()
  const { agentStatus, systemState, loading } = state

  const agent    = systemState?.agents?.[0]
  const snapshot = agent?.snapshot

  const onRefresh = useCallback(() => {
    actions.refreshState()
  }, [])

  return (
    <ScrollView
      style={s.container}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={onRefresh}
          tintColor={theme.colors.accent}
        />
      }
    >
      {/* Agent Status Header */}
      <Card style={s.statusCard}>
        <View style={s.row}>
          <StatusDot status={agentStatus} size={10} />
          <Label style={{ marginLeft: 8 }}>
            Agent — {agentStatus}
          </Label>
          {agent?.lastHeartbeat && (
            <Label dim style={{ marginLeft: 'auto', fontSize: 12 }}>
              {timeAgo(agent.lastHeartbeat)}
            </Label>
          )}
        </View>

        {snapshot && (
          <View style={{ marginTop: theme.space.sm }}>
            <View style={s.row}>
              <Label dim style={s.metaKey}>Memory</Label>
              <Label mono style={s.metaVal}>
                {snapshot.memory?.usedPct}% used
              </Label>
            </View>
            <View style={s.row}>
              <Label dim style={s.metaKey}>Load</Label>
              <Label mono style={s.metaVal}>
                {snapshot.load?.[0]?.toFixed(2)}
              </Label>
            </View>
            <View style={s.row}>
              <Label dim style={s.metaKey}>Uptime</Label>
              <Label mono style={s.metaVal}>
                {formatUptime(snapshot.uptime)}
              </Label>
            </View>
          </View>
        )}
      </Card>

      {/* Git State */}
      {snapshot?.git && (
        <Card>
          <Label dim style={s.sectionTitle}>GIT</Label>
          <View style={s.row}>
            <Label accent>⌥ {snapshot.git.branch}</Label>
            <Label dim style={{ marginLeft: 'auto' }}>
              {snapshot.git.dirty
                ? `${snapshot.git.changes} changes`
                : 'clean'}
            </Label>
          </View>
        </Card>
      )}

      {/* Running Processes */}
      {snapshot?.processes?.length > 0 && (
        <Card>
          <Label dim style={s.sectionTitle}>
            PROCESSES ({snapshot.processes.length})
          </Label>
          {snapshot.processes.map((proc, i) => (
            <View key={i} style={[s.processRow,
              i < snapshot.processes.length - 1 && s.processBorder]}>
              <View style={{ flex: 1 }}>
                <Label mono size={12} style={{ flexShrink: 1 }}>
                  {proc.command.slice(0, 50)}
                </Label>
                <Label dim size={11}>PID {proc.pid}</Label>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Label mono size={12}>CPU {proc.cpu}%</Label>
                <Label dim size={11}>MEM {proc.mem}%</Label>
              </View>
            </View>
          ))}
        </Card>
      )}

      {/* Quick Commands */}
      <Card>
        <Label dim style={s.sectionTitle}>QUICK COMMANDS</Label>
        <View style={s.cmdGrid}>
          {QUICK_COMMANDS.map(cmd => (
            <TouchableOpacity
              key={cmd.label}
              style={s.cmdBtn}
              onPress={() => actions.sendCommand(cmd.action, cmd.params)}
            >
              <Text style={s.cmdIcon}>{cmd.icon}</Text>
              <Label size={12}>{cmd.label}</Label>
            </TouchableOpacity>
          ))}
        </View>
      </Card>

      {/* Open JARVIS Chat */}
      <TouchableOpacity
        style={s.jarvisBtn}
        onPress={() => navigation.navigate('Chat')}
      >
        <Text style={s.jarvisText}>Talk to Axis</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  )
}

const QUICK_COMMANDS = [
  { label: 'Processes',  icon: '⚡', action: 'list_processes',  params: {} },
  { label: 'Git Status', icon: '⌥', action: 'get_git_status',  params: {} },
  { label: 'Top Logs',   icon: '📋', action: 'read_log',
    params: { filePath: '/tmp/axis-agent.log', lines: 30 } },
]

function timeAgo(ts) {
  const diff = Math.floor((Date.now() - new Date(ts)) / 1000)
  if (diff < 60)  return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

function formatUptime(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${h}h ${m}m`
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: theme.colors.bg, padding: theme.space.md },
  statusCard:   { marginTop: theme.space.md },
  row:          { flexDirection: 'row', alignItems: 'center' },
  metaKey:      { width: 70, fontSize: 12 },
  metaVal:      { fontSize: 12 },
  sectionTitle: { fontSize: 11, letterSpacing: 2, marginBottom: theme.space.sm },
  processRow:   { paddingVertical: theme.space.sm, flexDirection: 'row' },
  processBorder:{ borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  cmdGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.sm },
  cmdBtn:       { flex: 1, minWidth: '30%', backgroundColor: theme.colors.surfaceHigh,
                  borderRadius: theme.radius.sm, padding: theme.space.sm,
                  alignItems: 'center', gap: 4 },
  cmdIcon:      { fontSize: 20 },
  jarvisBtn:    { backgroundColor: theme.colors.accentDim,
                  borderWidth: 1, borderColor: theme.colors.accent,
                  borderRadius: theme.radius.md, padding: theme.space.md,
                  alignItems: 'center', marginTop: theme.space.sm },
  jarvisText:   { color: theme.colors.accent, fontWeight: '700', fontSize: 16 },
})