/**
 * app/login/page.tsx — Login page (route: "/login").
 */
'use client'

import { Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/hooks/use-auth'
import { AuthForm } from '@/components/organisms/AuthForm'

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { signInWithEmail, signInWithGoogle } = useAuth()

  const errorParam = searchParams.get('error')
  const rawRedirect = searchParams.get('redirect') ?? '/'
  const redirectTo = rawRedirect.startsWith('/') && !rawRedirect.startsWith('//')
    ? rawRedirect
    : '/'

  async function handleSubmit(email: string, password: string) {
    const result = await signInWithEmail(email, password)
    if (!result.error) {
      router.push(redirectTo)
      router.refresh()
    }
    return result
  }

  async function handleGoogleSignIn() {
    return signInWithGoogle()
  }

  return (
    <>
      <AuthForm
        mode="login"
        onSubmit={handleSubmit}
        onGoogleSignIn={handleGoogleSignIn}
      />
      {errorParam === 'auth_callback_failed' && (
        <p className="absolute bottom-8 text-sm text-red-400/80 text-center">
          Authentication failed. Please try again.
        </p>
      )}
    </>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen mesh-gradient flex items-center justify-center px-4">
      <Suspense>
        <LoginContent />
      </Suspense>
    </div>
  )
}
