/**
 * app/signup/page.tsx — Signup page (route: "/signup").
 */
'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/hooks/use-auth'
import { AuthForm } from '@/components/organisms/AuthForm'

export default function SignupPage() {
  const { signUpWithEmail, signInWithGoogle } = useAuth()
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  async function handleSubmit(email: string, password: string) {
    const result = await signUpWithEmail(email, password)
    if (!result.error) {
      setSuccessMessage('Check your email to confirm your account.')
    }
    return result
  }

  async function handleGoogleSignIn() {
    return signInWithGoogle()
  }

  return (
    <div className="min-h-screen mesh-gradient flex items-center justify-center px-4">
      <AuthForm
        mode="signup"
        onSubmit={handleSubmit}
        onGoogleSignIn={handleGoogleSignIn}
        successMessage={successMessage}
      />
    </div>
  )
}
