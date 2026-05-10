import React, { useEffect, useCallback } from 'react'
import { View, ScrollView, TouchableOpacity,
         StyleSheet, Linking, RefreshControl } from 'react-native'
import { useScout }  from '../store/scout.store'
import { Card }      from '../components/Card'
import { Label }     from '../components/Label'
import { scoreColor, scoreLabel } from '../utils/score'
import { theme }     from '../theme'

export function ScoutScreen({ navigation }) {
  const { state, actions } = useScout()
  const { digest, loading } = state

  useEffect(() => { actions.loadDigest() }, [])

  const onRefresh = useCallback(() => actions.loadDigest(), [])

  if (!digest && !loading) {
    return (
      <View style={s.empty}>
        <Label dim>No digest yet.</Label>
        <TouchableOpacity style={s.runBtn} onPress={actions.runPipeline}>
          <Label accent>Run Scout Now</Label>
        </TouchableOpacity>
      </View>
    )
  }

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
      {/* Stats Header */}
      <Card style={{ marginTop: theme.space.md }}>
        <Label dim size={11} style={{ letterSpacing: 2, marginBottom: 8 }}>
          SCOUT DAILY BRIEF — {digest?.date}
        </Label>
        <View style={s.statsRow}>
          {[
            [digest?.total_processed || 0, 'scanned',  theme.colors.text],
            [digest?.total_filtered   || 0, 'filtered', theme.colors.warn],
            [digest?.top_picks?.length || 0, 'worth it', theme.colors.accent],
          ].map(([val, label, color]) => (
            <View key={label} style={s.stat}>
              <Label size={24} style={{ fontWeight: '700', color }}>{val}</Label>
              <Label dim size={11}>{label}</Label>
            </View>
          ))}
        </View>
      </Card>

      {/* Top Picks */}
      {digest?.top_picks?.length > 0 && (
        <>
          <Label dim size={11} style={s.section}>WORTH YOUR TIME</Label>
          {digest.top_picks.map(job => (
            <JobCard key={job.id} job={job} />
          ))}
        </>
      )}

      {/* Decent */}
      {digest?.decent?.length > 0 && (
        <>
          <Label dim size={11} style={s.section}>DECENT, NOT URGENT</Label>
          {digest.decent.map(job => (
            <JobCard key={job.id} job={job} compact />
          ))}
        </>
      )}

      <TouchableOpacity
        style={s.chatBtn}
        onPress={() => navigation.navigate('Chat')}
      >
        <Label accent style={{ fontWeight: '700' }}>
          Ask Axis about these →
        </Label>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  )
}

function JobCard({ job, compact }) {
  return (
    <Card>
      <View style={s.jobHeader}>
        <Label size={compact ? 13 : 15} style={{ flex: 1, fontWeight: '600' }}>
          {job.title}
        </Label>
        <Label size={compact ? 13 : 16}
          style={{ color: scoreColor(job.overall_score), marginLeft: 8 }}>
          {scoreLabel(job.overall_score)} {job.overall_score?.toFixed(1)}
        </Label>
      </View>

      <Label dim size={13} style={{ marginTop: 2 }}>
        {job.company} · {job.location}
      </Label>

      {!compact && job.blurb && (
        <Label size={13} style={{ marginTop: 8, lineHeight: 20,
          color: theme.colors.textDim, fontStyle: 'italic' }}>
          "{job.blurb}"
        </Label>
      )}

      <View style={s.jobFooter}>
        <Label faint size={11}>{job.source}</Label>
        <TouchableOpacity onPress={() => Linking.openURL(job.url)}>
          <Label accent size={12}>View →</Label>
        </TouchableOpacity>
      </View>
    </Card>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg, padding: theme.space.md },
  empty:     { flex: 1, alignItems: 'center', justifyContent: 'center',
               backgroundColor: theme.colors.bg },
  runBtn:    { marginTop: theme.space.md, padding: theme.space.md },
  statsRow:  { flexDirection: 'row', justifyContent: 'space-around' },
  stat:      { alignItems: 'center' },
  section:   { letterSpacing: 2, marginTop: theme.space.lg,
               marginBottom: theme.space.sm },
  jobHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  jobFooter: { flexDirection: 'row', justifyContent: 'space-between',
               alignItems: 'center', marginTop: theme.space.sm },
  chatBtn:   { backgroundColor: theme.colors.accentDim, borderWidth: 1,
               borderColor: theme.colors.accent, borderRadius: theme.radius.md,
               padding: theme.space.md, alignItems: 'center',
               marginTop: theme.space.md },
})