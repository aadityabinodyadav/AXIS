import React, { useState, useRef, useEffect } from 'react'
import { View, TextInput, TouchableOpacity, FlatList,
         StyleSheet, KeyboardAvoidingView,
         Platform, ActivityIndicator }          from 'react-native'
import { Audio }    from 'expo-av'
import * as Speech  from 'expo-speech'
import { useAxis }  from '../store'
import { Label }    from '../components/Label'
import { theme }    from '../theme'

const SESSION_ID = 'mobile-session'

export function ChatScreen() {
  const { actions }          = useAxis()
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Axis online. What do you need?' }
  ])
  const [input, setInput]   = useState('')
  const [loading, setLoading] = useState(false)
  const [voiceMode, setVoiceMode] = useState(false)
  const [recording, setRecording] = useState(null)
  const listRef = useRef(null)

  // Auto-scroll on new message
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100)
    }
  }, [messages])

  async function send(text) {
    if (!text.trim() || loading) return

    const userMsg = { role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const data  = await actions.chat(text, SESSION_ID)
      const reply = data.reply

      setMessages(prev => [...prev, { role: 'assistant', content: reply }])

      // Speak reply if voice mode on
      if (voiceMode) {
        Speech.speak(reply, {
          rate:   0.95,
          pitch:  1.0,
          language: 'en-US',
        })
      }

    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Error: ${err.message}`,
        error: true,
      }])
    } finally {
      setLoading(false)
    }
  }

  async function startRecording() {
    try {
      await Audio.requestPermissionsAsync()
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true })

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      )
      setRecording(recording)
    } catch (err) {
      console.error('recording failed', err)
    }
  }

  async function stopRecording() {
    if (!recording) return

    await recording.stopAndUnloadAsync()
    const uri = recording.getURI()
    setRecording(null)

    // Send to Whisper via gateway
    try {
      const formData = new FormData()
      formData.append('audio', {
        uri,
        type: 'audio/m4a',
        name: 'recording.m4a',
      })

      const response = await fetch(`${CONFIG.GATEWAY_URL}/v1/transcribe`, {
        method:  'POST',
        headers: { 'Authorization': `Bearer ${await api.getToken()}` },
        body:    formData,
      })

      const data = await response.json()
      if (data.text) send(data.text)

    } catch (err) {
      console.error('transcription failed', err)
    }
  }

  function renderMessage({ item }) {
    const isUser = item.role === 'user'
    return (
      <View style={[s.bubble, isUser ? s.userBubble : s.axisLabel]}>
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
  }

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
      />

      {loading && (
        <View style={s.thinking}>
          <ActivityIndicator size="small" color={theme.colors.accent} />
          <Label dim size={12} style={{ marginLeft: 8 }}>thinking...</Label>
        </View>
      )}

      {/* Input Row */}
      <View style={s.inputRow}>
        {/* Voice toggle */}
        <TouchableOpacity
          style={[s.iconBtn, voiceMode && s.iconBtnActive]}
          onPress={() => setVoiceMode(v => !v)}
        >
          <Label size={18}>🔊</Label>
        </TouchableOpacity>

        {/* Text input */}
        <TextInput
          style={s.input}
          value={input}
          onChangeText={setInput}
          placeholder="Ask Axis..."
          placeholderTextColor={theme.colors.textFaint}
          onSubmitEditing={() => send(input)}
          returnKeyType="send"
          multiline
        />

        {/* Send / Mic */}
        {input.trim() ? (
          <TouchableOpacity style={s.sendBtn} onPress={() => send(input)}>
            <Label accent size={18}>↑</Label>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[s.iconBtn, recording && s.recording]}
            onPressIn={startRecording}
            onPressOut={stopRecording}
          >
            <Label size={18}>{recording ? '⏺' : '🎤'}</Label>
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: theme.colors.bg },
  list:        { flex: 1 },
  bubble:      { marginBottom: theme.space.sm, maxWidth: '90%' },
  userBubble:  { alignSelf: 'flex-end', backgroundColor: theme.colors.surfaceHigh,
                 borderRadius: theme.radius.md, padding: theme.space.sm,
                 borderWidth: 1, borderColor: theme.colors.border },
  axisLabel:   { alignSelf: 'flex-start' },
  sender:      { marginBottom: 4, letterSpacing: 2 },
  msgText:     { fontSize: 14, lineHeight: 22 },
  thinking:    { flexDirection: 'row', alignItems: 'center',
                 paddingHorizontal: theme.space.md, paddingBottom: 8 },
  inputRow:    { flexDirection: 'row', alignItems: 'flex-end',
                 padding: theme.space.sm, borderTopWidth: 1,
                 borderTopColor: theme.colors.border,
                 backgroundColor: theme.colors.surface },
  input:       { flex: 1, color: theme.colors.text, fontSize: 14,
                 paddingHorizontal: theme.space.sm, maxHeight: 100 },
  iconBtn:     { padding: theme.space.sm, borderRadius: theme.radius.sm },
  iconBtnActive:{ backgroundColor: theme.colors.accentDim },
  sendBtn:     { padding: theme.space.sm },
  recording:   { backgroundColor: '#FF444420' },
})