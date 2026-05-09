import React, { useState }              from 'react'
import { View, TextInput, TouchableOpacity,
         Text, StyleSheet, KeyboardAvoidingView } from 'react-native'
import { useAxis }  from '../store'
import { theme }    from '../theme'

export function AuthScreen() {
  const { actions }  = useAxis()
  const [token, setToken] = useState('')
  const [error, setError] = useState(null)

  async function handleConnect() {
    if (!token.trim()) return
    try {
      await actions.setToken(token.trim())
    } catch (err) {
      setError('Could not connect — check your token and gateway URL')
    }
  }

  return (
    <KeyboardAvoidingView behavior="padding" style={s.container}>
      <View style={s.inner}>

        <Text style={s.logo}>AXIS</Text>
        <Text style={s.sub}>Personal dev intelligence</Text>

        <View style={s.inputWrap}>
          <TextInput
            style={s.input}
            placeholder="Paste your auth token"
            placeholderTextColor={theme.colors.textFaint}
            value={token}
            onChangeText={setToken}
            autoCapitalize="none"
            autoCorrect={false}
            multiline
          />
        </View>

        {error && (
          <Text style={s.error}>{error}</Text>
        )}

        <TouchableOpacity style={s.btn} onPress={handleConnect}>
          <Text style={s.btnText}>Connect</Text>
        </TouchableOpacity>

        <Text style={s.hint}>
          Get your token:{'\n'}
          POST /dev/token on your gateway
        </Text>
      </View>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  inner:     { flex: 1, justifyContent: 'center', padding: theme.space.xl },
  logo:      { fontSize: 48, fontWeight: '700', color: theme.colors.accent,
               letterSpacing: 8, textAlign: 'center', marginBottom: 8 },
  sub:       { color: theme.colors.textDim, textAlign: 'center',
               marginBottom: 48, fontSize: 13 },
  inputWrap: { borderWidth: 1, borderColor: theme.colors.border,
               borderRadius: theme.radius.md, marginBottom: 16 },
  input:     { color: theme.colors.text, padding: theme.space.md,
               fontSize: 13, fontFamily: theme.font.mono, minHeight: 80 },
  btn:       { backgroundColor: theme.colors.accent,
               borderRadius: theme.radius.md, padding: theme.space.md,
               alignItems: 'center', marginBottom: 24 },
  btnText:   { color: theme.colors.bg, fontWeight: '700', fontSize: 16 },
  error:     { color: theme.colors.error, marginBottom: 16, fontSize: 13 },
  hint:      { color: theme.colors.textFaint, textAlign: 'center',
               fontSize: 12, lineHeight: 20 },
})