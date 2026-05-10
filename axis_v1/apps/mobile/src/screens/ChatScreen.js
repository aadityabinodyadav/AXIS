/**
 * Chat Screen
 * JARVIS interface — text + voice.
 * All state from chat.store. No business logic here.
 */

import React, { useRef, useEffect, useCallback } from 'react'
import { View, TextInput, TouchableOpacity,
         FlatList, StyleSheet, KeyboardAvoidingView,
         Platform, ActivityIndicator, Alert }      from 'react-native'
import { Audio }   from 'expo-av'
import * as Speech from 'expo-speech'
import { useChat } from '../store/chat.store'
import { api }     from '../api/client'
import { Label }   from '../components/Label'
import { theme }   from '../theme'
import { CONFIG }  from '../config'

export function ChatScreen() {
  const { state, actions } = useChat()
  const { messages, loading, voiceMode } = state

  const [input, setInput]       = React.useState('')
  const [recording, setRecording] = React.useState(null)
  const listRef = useRef(null)

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100)
    }
  }, [messages.length])

  const handleSend = useCallback(async (text) => {
    if (!text.trim() || loading) return
    setInput('')
    const reply = await actions.send(text)

    // Speak if voice mode on and reply came back
    if (reply && voiceMode) {
      Speech.speak(reply, { rate: 0.95, pitch: 1.0, language: 'en-US' })
    }
  }, [loading, voiceMode, actions])

  const handleRecordStart = useCallback(async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Microphone access is required for voice input.')
        return
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true })
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      )
      setRecording(recording)
    } catch {
      Alert.alert('Error', 'Could not start recording.')
    }
  }, [])

  const handleRecordStop = useCallback(async () => {
    if (!recording) return
    try {
      await recording.stopAndUnloadAsync()
      const uri = recording.getURI()
      setRecording(null)

      // Send to transcription endpoint
      const token    = await api.getToken()
      const formData = new FormData()
      formData.append('audio', { uri, type: 'audio/m4a', name: 'voice.m4a' })

      const r = await fetch(`${CONFIG.GATEWAY_URL}/v1/transcribe`, {
        method:  'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body:    formData,
      })

      const data = await r.json()
      if (data?.data?.text) {
        handleSend(data.data.text)
      } else {
        Alert.alert('Transcription failed', 'Could not understand audio. Try again.')
      }
    } catch {
      setRecording(null)
      Alert.alert('Error', 'Voice processing failed.')
    }
  }, [recording, handleSend])

  const renderMessage = useCallback(({ item }) => {
    const isUser = item.role === 'user'
    return (
      <View style={[s.bubble, isUser ? s.userBubble : s.axisBubble]}>
        {!isUser && (
          <Label accent size={11} style={s.sender}>AXIS</Label>
        )}
        <Label
          mono={!isUser}
          style={[s.msgText, item.error && { color: theme.colors.error }]}
        >
          {item.content}
        </Label>
      </View>
    )
  }, [])

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(_, i) => String(i)}
        renderItem={renderMessage}
        style={s.list}
        contentContainerStyle={{ padding: theme.space.md }}
        removeClippedSubviews
        maxToRenderPerBatch={10}
        windowSize={10}
      />

      {loading && (
        <View style={s.thinking}>
          <ActivityIndicator size="small" color={theme.colors.accent} />
          <Label dim size={12} style={{ marginLeft: 8 }}>thinking...</Label>
        </View>
      )}

      <View style={s.inputRow}>
        {/* Voice mode toggle */}
        <TouchableOpacity
          style={[s.iconBtn, voiceMode && s.iconBtnActive]}
          onPress={actions.toggleVoice}
        >
          <Label size={18}>🔊</Label>
        </TouchableOpacity>

        <TextInput
          style={s.input}
          value={input}
          onChangeText={setInput}
          placeholder="Ask Axis..."
          placeholderTextColor={theme.colors.textFaint}
          onSubmitEditing={() => handleSend(input)}
          returnKeyType="send"
          multiline
        />

        {input.trim() ? (
          <TouchableOpacity style={s.sendBtn} onPress={() => handleSend(input)}>
            <Label accent size={20}>↑</Label>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[s.iconBtn, recording && s.recording]}
            onPressIn={handleRecordStart}
            onPressOut={handleRecordStop}
          >
            <Label size={18}>{recording ? '⏺' : '🎤'}</Label>
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: theme.colors.bg },
  list:         { flex: 1 },
  bubble:       { marginBottom: theme.space.sm, maxWidth: '90%' },
  userBubble:   { alignSelf: 'flex-end', backgroundColor: theme.colors.surfaceHigh,
                  borderRadius: theme.radius.md, padding: theme.space.sm,
                  borderWidth: 1, borderColor: theme.colors.border },
  axisBubble:   { alignSelf: 'flex-start' },
  sender:       { marginBottom: 4, letterSpacing: 2 },
  msgText:      { fontSize: 14, lineHeight: 22 },
  thinking:     { flexDirection: 'row', alignItems: 'center',
                  paddingHorizontal: theme.space.md, paddingBottom: 8 },
  inputRow:     { flexDirection: 'row', alignItems: 'flex-end',
                  padding: theme.space.sm, borderTopWidth: 1,
                  borderTopColor: theme.colors.border,
                  backgroundColor: theme.colors.surface },
  input:        { flex: 1, color: theme.colors.text, fontSize: 14,
                  paddingHorizontal: theme.space.sm, maxHeight: 100 },
  iconBtn:      { padding: theme.space.sm, borderRadius: theme.radius.sm },
  iconBtnActive:{ backgroundColor: theme.colors.accentDim },
  sendBtn:      { padding: theme.space.sm },
  recording:    { backgroundColor: '#FF444420' },
})