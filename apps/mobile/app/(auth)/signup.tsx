/**
 * Signup screen — Email/password with confirmation.
 */

import { useState } from 'react'
import { View, Text, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, Link } from 'expo-router'
import { X } from 'lucide-react-native'
import { useAuth } from '@/lib/hooks/use-auth'
import { signupSchema } from '@/lib/shared/validation/auth'
import { GlassView } from '@/components/ui/GlassView'

export default function SignupScreen() {
  const router = useRouter()
  const { signUpWithEmail } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSignup = async () => {
    setError(null)
    setFieldErrors({})

    const result = signupSchema.safeParse({ email, password, confirmPassword })
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
      const { error: authError } = await signUpWithEmail(email, password)
      if (authError) {
        setError(authError)
      } else {
        router.replace('/(tabs)')
      }
    } finally {
      setIsSubmitting(false)
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
          Create your account
        </Text>

        <GlassView style={{ padding: 24, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.12)' }}>
          <Text style={{ fontFamily: 'Inter-SemiBold', fontSize: 20, color: 'white', marginBottom: 20 }}>
            Sign Up
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
              <Text style={{ fontFamily: 'Inter', fontSize: 12, color: '#ef4444', marginTop: 4 }}>{fieldErrors.email}</Text>
            )}
          </View>

          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontFamily: 'Inter', fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 6 }}>Password</Text>
            <TextInput
              testID="password-input"
              value={password}
              onChangeText={setPassword}
              placeholder="At least 8 characters"
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
              <Text style={{ fontFamily: 'Inter', fontSize: 12, color: '#ef4444', marginTop: 4 }}>{fieldErrors.password}</Text>
            )}
          </View>

          <View style={{ marginBottom: 24 }}>
            <Text style={{ fontFamily: 'Inter', fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 6 }}>Confirm Password</Text>
            <TextInput
              testID="confirm-password-input"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirm your password"
              placeholderTextColor="rgba(255,255,255,0.25)"
              secureTextEntry
              style={{
                fontFamily: 'Inter',
                fontSize: 15,
                color: 'white',
                backgroundColor: 'rgba(255,255,255,0.10)',
                borderRadius: 12,
                borderWidth: 0.5,
                borderColor: fieldErrors.confirmPassword ? '#ef4444' : 'rgba(255,255,255,0.15)',
                padding: 14,
              }}
            />
            {fieldErrors.confirmPassword && (
              <Text style={{ fontFamily: 'Inter', fontSize: 12, color: '#ef4444', marginTop: 4 }}>{fieldErrors.confirmPassword}</Text>
            )}
          </View>

          <Pressable
            testID="create-account-button"
            onPress={handleSignup}
            disabled={isSubmitting}
            style={({ pressed }) => ({
              backgroundColor: pressed ? 'rgba(255,255,255,0.85)' : 'white',
              borderRadius: 12,
              padding: 14,
              alignItems: 'center',
              opacity: isSubmitting ? 0.5 : 1,
            })}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#0A0A0A" size="small" />
            ) : (
              <Text style={{ fontFamily: 'Inter-SemiBold', fontSize: 15, color: '#0A0A0A' }}>
                Create Account
              </Text>
            )}
          </Pressable>
        </GlassView>

        <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 24, gap: 4 }}>
          <Text style={{ fontFamily: 'Inter', fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>
            Already have an account?
          </Text>
          <Link href="/(auth)/login">
            <Text style={{ fontFamily: 'Inter-SemiBold', fontSize: 14, color: 'white' }}>
              Sign In
            </Text>
          </Link>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
