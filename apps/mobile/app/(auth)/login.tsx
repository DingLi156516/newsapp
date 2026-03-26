/**
 * Login screen — Email/password + Google OAuth.
 * Adapts web AuthForm with React Native inputs.
 */

import { useState } from 'react'
import { View, Text, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, Link } from 'expo-router'
import { X } from 'lucide-react-native'
import { useAuth } from '@/lib/hooks/use-auth'
import { loginSchema } from '@/lib/shared/validation/auth'
import { GlassView } from '@/components/ui/GlassView'

export default function LoginScreen() {
  const router = useRouter()
  const { signInWithEmail, signInWithGoogle } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleLogin = async () => {
    setError(null)
    setFieldErrors({})

    const result = loginSchema.safeParse({ email, password })
    if (!result.success) {
      const errors: Record<string, string> = {}
      for (const issue of result.error.issues) {
        const field = issue.path[0]?.toString()
        if (field) errors[field] = issue.message
      }
      setFieldErrors(errors)
      return
    }

    setIsSubmitting(true)
    try {
      const { error: authError } = await signInWithEmail(email, password)
      if (authError) {
        setError(authError)
      } else {
        router.replace('/(tabs)')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleGoogleLogin = async () => {
    setError(null)
    const { error: authError } = await signInWithGoogle()
    if (authError) {
      setError(authError)
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0A0A0A' }}>
      {/* Close button */}
      <Pressable
        onPress={() => router.dismiss()}
        hitSlop={12}
        testID="close-button"
        style={{ position: 'absolute', top: 60, right: 20, zIndex: 10 }}
      >
        <X size={24} color="rgba(255,255,255,0.6)" />
      </Pressable>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 24 }}
      >
        <Text
          style={{ fontFamily: 'DMSerifDisplay', fontSize: 32, color: 'white', textAlign: 'center', marginBottom: 8 }}
        >
          Axiom
        </Text>
        <Text style={{ fontFamily: 'Inter', fontSize: 14, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginBottom: 32 }}>
          See the Full Spectrum
        </Text>

        <GlassView style={{ padding: 24, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.12)' }}>
          <Text style={{ fontFamily: 'Inter-SemiBold', fontSize: 20, color: 'white', marginBottom: 20 }}>
            Sign In
          </Text>

          {error && (
            <View style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', borderRadius: 8, padding: 12, marginBottom: 16 }}>
              <Text style={{ fontFamily: 'Inter', fontSize: 13, color: '#ef4444' }}>{error}</Text>
            </View>
          )}

          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontFamily: 'Inter', fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 6 }}>Email</Text>
            <TextInput
              testID="email-input"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor="rgba(255,255,255,0.25)"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              style={{
                fontFamily: 'Inter',
                fontSize: 15,
                color: 'white',
                backgroundColor: 'rgba(255,255,255,0.10)',
                borderRadius: 12,
                borderWidth: 0.5,
                borderColor: fieldErrors.email ? '#ef4444' : 'rgba(255,255,255,0.15)',
                padding: 14,
              }}
            />
            {fieldErrors.email && (
              <Text style={{ fontFamily: 'Inter', fontSize: 12, color: '#ef4444', marginTop: 4 }}>
                {fieldErrors.email}
              </Text>
            )}
          </View>

          <View style={{ marginBottom: 24 }}>
            <Text style={{ fontFamily: 'Inter', fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 6 }}>Password</Text>
            <TextInput
              testID="password-input"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor="rgba(255,255,255,0.25)"
              secureTextEntry
              style={{
                fontFamily: 'Inter',
                fontSize: 15,
                color: 'white',
                backgroundColor: 'rgba(255,255,255,0.10)',
                borderRadius: 12,
                borderWidth: 0.5,
                borderColor: fieldErrors.password ? '#ef4444' : 'rgba(255,255,255,0.15)',
                padding: 14,
              }}
            />
            {fieldErrors.password && (
              <Text style={{ fontFamily: 'Inter', fontSize: 12, color: '#ef4444', marginTop: 4 }}>
                {fieldErrors.password}
              </Text>
            )}
          </View>

          <Pressable
            testID="sign-in-button"
            onPress={handleLogin}
            disabled={isSubmitting}
            style={({ pressed }) => ({
              backgroundColor: pressed ? 'rgba(255,255,255,0.85)' : 'white',
              borderRadius: 12,
              padding: 14,
              alignItems: 'center',
              opacity: isSubmitting ? 0.5 : 1,
              marginBottom: 12,
            })}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#0A0A0A" size="small" />
            ) : (
              <Text style={{ fontFamily: 'Inter-SemiBold', fontSize: 15, color: '#0A0A0A' }}>
                Sign In
              </Text>
            )}
          </Pressable>

          <Pressable
            testID="google-oauth-button"
            onPress={handleGoogleLogin}
            style={({ pressed }) => ({
              backgroundColor: pressed ? 'rgba(255,255,255,0.08)' : 'transparent',
              borderRadius: 12,
              borderWidth: 0.5,
              borderColor: 'rgba(255,255,255,0.25)',
              padding: 14,
              alignItems: 'center',
            })}
          >
            <Text style={{ fontFamily: 'Inter', fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>
              Continue with Google
            </Text>
          </Pressable>
        </GlassView>

        <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 24, gap: 4 }}>
          <Text style={{ fontFamily: 'Inter', fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>
            Don't have an account?
          </Text>
          <Link href="/(auth)/signup">
            <Text style={{ fontFamily: 'Inter-SemiBold', fontSize: 14, color: 'white' }}>
              Sign Up
            </Text>
          </Link>
        </View>

        <Pressable
          testID="skip-button"
          onPress={() => router.dismiss()}
          style={{ marginTop: 16, alignItems: 'center' }}
        >
          <Text style={{ fontFamily: 'Inter', fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>
            Skip for now
          </Text>
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
