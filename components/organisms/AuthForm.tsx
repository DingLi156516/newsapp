/**
 * components/organisms/AuthForm.tsx — Shared login/signup form.
 *
 * Renders email/password fields with Zod validation, Google OAuth button,
 * and toggles between login and signup modes via a link.
 */
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Mail, Lock, Eye, EyeOff } from 'lucide-react'
import { loginSchema, signupSchema } from '@/lib/auth/validation'

interface AuthFormProps {
  readonly mode: 'login' | 'signup'
  readonly onSubmit: (email: string, password: string) => Promise<{ error: string | null }>
  readonly onGoogleSignIn: () => Promise<{ error: string | null }>
  readonly successMessage?: string | null
}

interface FieldErrors {
  readonly email?: string
  readonly password?: string
  readonly confirmPassword?: string
}

export function AuthForm({ mode, onSubmit, onGoogleSignIn, successMessage }: AuthFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isLogin = mode === 'login'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFieldErrors({})
    setServerError(null)

    // Validate with Zod
    const schema = isLogin ? loginSchema : signupSchema
    const input = isLogin
      ? { email, password }
      : { email, password, confirmPassword }

    const result = schema.safeParse(input)
    if (!result.success) {
      const errors: Record<string, string> = {}
      for (const issue of result.error.issues) {
        const key = issue.path[0] as string
        if (!errors[key]) {
          errors[key] = issue.message
        }
      }
      setFieldErrors(errors)
      return
    }

    setIsSubmitting(true)
    try {
      const { error } = await onSubmit(email, password)
      if (error) {
        setServerError(error)
      }
    } catch {
      setServerError('An unexpected error occurred. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleGoogleSignIn() {
    setServerError(null)
    const { error } = await onGoogleSignIn()
    if (error) {
      setServerError(error)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="glass w-full max-w-sm p-8 space-y-6"
    >
      <h1
        className="text-2xl font-bold text-white text-center"
        style={{ fontFamily: 'DM Serif Display, Georgia, serif' }}
      >
        {isLogin ? 'Sign In' : 'Create Account'}
      </h1>

      {successMessage && (
        <p className="text-sm text-green-400/80 text-center">{successMessage}</p>
      )}

      {serverError && (
        <p className="text-sm text-red-400/80 text-center">{serverError}</p>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {/* Email field */}
        <div className="space-y-1">
          <div className="glass-sm flex items-center gap-2 px-3 py-2.5">
            <Mail size={16} className="text-white/40 shrink-0" />
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-transparent text-sm text-white placeholder-white/40 outline-none"
              autoComplete="email"
            />
          </div>
          {fieldErrors.email && (
            <p className="text-xs text-red-400/80 pl-1">{fieldErrors.email}</p>
          )}
        </div>

        {/* Password field */}
        <div className="space-y-1">
          <div className="glass-sm flex items-center gap-2 px-3 py-2.5">
            <Lock size={16} className="text-white/40 shrink-0" />
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-transparent text-sm text-white placeholder-white/40 outline-none"
              autoComplete={isLogin ? 'current-password' : 'new-password'}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="text-white/40 hover:text-white/60 transition-colors shrink-0"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {fieldErrors.password && (
            <p className="text-xs text-red-400/80 pl-1">{fieldErrors.password}</p>
          )}
        </div>

        {/* Confirm password field (signup only) */}
        {!isLogin && (
          <div className="space-y-1">
            <div className="glass-sm flex items-center gap-2 px-3 py-2.5">
              <Lock size={16} className="text-white/40 shrink-0" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-transparent text-sm text-white placeholder-white/40 outline-none"
                autoComplete="new-password"
              />
            </div>
            {fieldErrors.confirmPassword && (
              <p className="text-xs text-red-400/80 pl-1">{fieldErrors.confirmPassword}</p>
            )}
          </div>
        )}

        {/* Submit button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="glass-pill w-full py-2.5 text-sm font-medium text-white hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting
            ? 'Please wait...'
            : isLogin
              ? 'Sign In'
              : 'Create Account'}
        </button>
      </form>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-white/10" />
        <span className="text-xs text-white/40">or</span>
        <div className="flex-1 h-px bg-white/10" />
      </div>

      {/* Google OAuth button */}
      <button
        type="button"
        onClick={handleGoogleSignIn}
        className="glass-pill w-full py-2.5 text-sm text-white/80 hover:text-white hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" className="shrink-0">
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
        </svg>
        Continue with Google
      </button>

      {/* Toggle link */}
      <p className="text-center text-xs text-white/50">
        {isLogin ? (
          <>
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-white/80 hover:text-white transition-colors">
              Sign up
            </Link>
          </>
        ) : (
          <>
            Already have an account?{' '}
            <Link href="/login" className="text-white/80 hover:text-white transition-colors">
              Sign in
            </Link>
          </>
        )}
      </p>
    </motion.div>
  )
}
