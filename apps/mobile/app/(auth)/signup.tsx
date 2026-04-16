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
import { useTheme } from '@/lib/shared/theme'
import { PaperTextureOverlay } from '@/components/ui/PaperTextureOverlay'

export default function SignupScreen() {
  const router = useRouter()
  const theme = useTheme()
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

  const errSemantic = theme.semantic.error
  const inputBg = `rgba(${theme.inkRgb}, 0.10)`
  const inputBorderDefault = theme.surface.border
  const fieldLabel = { fontFamily: 'Inter', fontSize: 13, color: theme.text.secondary, marginBottom: 6 } as const
  const inputBase = {
    fontFamily: 'Inter',
    fontSize: 15,
    color: theme.text.primary,
    backgroundColor: inputBg,
    borderRadius: 12,
    borderWidth: 0.5,
    padding: 14,
  } as const

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.surface.background }}>
      {/* Close button */}
      <Pressable
        onPress={() => router.dismiss()}
        hitSlop={12}
        testID="close-button"
        style={{ position: 'absolute', top: 60, right: 20, zIndex: 10 }}
      >
        <X size={24} color={theme.text.secondary} />
      </Pressable>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 24 }}
      >
        <Text
          style={{ fontFamily: 'DMSerifDisplay', fontSize: 32, color: theme.text.primary, textAlign: 'center', marginBottom: 8 }}
        >
          Axiom
        </Text>
        <Text style={{ fontFamily: 'Inter', fontSize: 14, color: theme.text.tertiary, textAlign: 'center', marginBottom: 32 }}>
          Create your account
        </Text>

        <GlassView style={{ padding: 24, borderWidth: 0.5, borderColor: theme.surface.border }}>
          <Text style={{ fontFamily: 'Inter-SemiBold', fontSize: 20, color: theme.text.primary, marginBottom: 20 }}>
            Sign Up
          </Text>

          {error && (
            <View style={{ backgroundColor: errSemantic.bg, borderRadius: 8, padding: 12, marginBottom: 16 }}>
              <Text style={{ fontFamily: 'Inter', fontSize: 13, color: errSemantic.color }}>{error}</Text>
            </View>
          )}

          <View style={{ marginBottom: 16 }}>
            <Text style={fieldLabel}>Email</Text>
            <TextInput
              testID="email-input"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={theme.text.muted}
              keyboardType="email-address"
              keyboardAppearance={theme.name === 'paper' ? 'light' : 'dark'}
              autoCapitalize="none"
              autoCorrect={false}
              style={[inputBase, { borderColor: fieldErrors.email ? errSemantic.color : inputBorderDefault }]}
            />
            {fieldErrors.email && (
              <Text style={{ fontFamily: 'Inter', fontSize: 12, color: errSemantic.color, marginTop: 4 }}>{fieldErrors.email}</Text>
            )}
          </View>

          <View style={{ marginBottom: 16 }}>
            <Text style={fieldLabel}>Password</Text>
            <TextInput
              testID="password-input"
              value={password}
              onChangeText={setPassword}
              placeholder="At least 8 characters"
              placeholderTextColor={theme.text.muted}
              secureTextEntry
              keyboardAppearance={theme.name === 'paper' ? 'light' : 'dark'}
              style={[inputBase, { borderColor: fieldErrors.password ? errSemantic.color : inputBorderDefault }]}
            />
            {fieldErrors.password && (
              <Text style={{ fontFamily: 'Inter', fontSize: 12, color: errSemantic.color, marginTop: 4 }}>{fieldErrors.password}</Text>
            )}
          </View>

          <View style={{ marginBottom: 24 }}>
            <Text style={fieldLabel}>Confirm Password</Text>
            <TextInput
              testID="confirm-password-input"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirm your password"
              placeholderTextColor={theme.text.muted}
              secureTextEntry
              keyboardAppearance={theme.name === 'paper' ? 'light' : 'dark'}
              style={[inputBase, { borderColor: fieldErrors.confirmPassword ? errSemantic.color : inputBorderDefault }]}
            />
            {fieldErrors.confirmPassword && (
              <Text style={{ fontFamily: 'Inter', fontSize: 12, color: errSemantic.color, marginTop: 4 }}>{fieldErrors.confirmPassword}</Text>
            )}
          </View>

          <Pressable
            testID="create-account-button"
            onPress={handleSignup}
            disabled={isSubmitting}
            style={({ pressed }) => ({
              backgroundColor: pressed ? theme.text.secondary : theme.text.primary,
              borderRadius: 12,
              padding: 14,
              alignItems: 'center',
              opacity: isSubmitting ? 0.5 : 1,
            })}
          >
            {isSubmitting ? (
              <ActivityIndicator color={theme.surface.background} size="small" />
            ) : (
              <Text style={{ fontFamily: 'Inter-SemiBold', fontSize: 15, color: theme.surface.background }}>
                Create Account
              </Text>
            )}
          </Pressable>
        </GlassView>

        <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 24, gap: 4 }}>
          <Text style={{ fontFamily: 'Inter', fontSize: 14, color: theme.text.tertiary }}>
            Already have an account?
          </Text>
          <Link href="/(auth)/login">
            <Text style={{ fontFamily: 'Inter-SemiBold', fontSize: 14, color: theme.text.primary }}>
              Sign In
            </Text>
          </Link>
        </View>
      </KeyboardAvoidingView>
      {/* Texture overlay must be the LAST child so it paints above modal
         content (matching the root shell). It is pointer-transparent, so
         all buttons remain tappable. */}
      <PaperTextureOverlay />
    </SafeAreaView>
  )
}
