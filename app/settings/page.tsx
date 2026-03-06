/**
 * app/settings/page.tsx — User preferences settings page.
 *
 * Protected route that renders the SettingsForm for authenticated users.
 * Redirects to /login via useRequireAuth if not signed in.
 */
'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft, Settings } from 'lucide-react'
import { UserMenu } from '@/components/organisms/UserMenu'
import { SettingsForm } from '@/components/organisms/SettingsForm'
import { useRequireAuth } from '@/lib/hooks/use-require-auth'

export default function SettingsPage() {
  const router = useRouter()
  useRequireAuth()

  return (
    <div className="min-h-screen mesh-gradient">
      <div className="mx-auto max-w-2xl px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push('/')}
            className="glass-pill flex items-center gap-1.5 px-3 py-2 text-sm text-white/80 hover:text-white transition-colors"
          >
            <ArrowLeft size={14} />
            Feed
          </button>
          <UserMenu />
        </div>

        {/* Title */}
        <div className="glass p-5 space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white/10 border border-white/10">
              <Settings size={16} className="text-white/80" />
            </div>
            <h1
              className="text-xl font-bold text-white"
              style={{ fontFamily: 'DM Serif Display, Georgia, serif' }}
            >
              Settings
            </h1>
          </div>
          <p className="text-sm text-white/70 leading-relaxed">
            Customize your news feed preferences. Changes are saved automatically.
          </p>
        </div>

        {/* Settings form */}
        <SettingsForm />
      </div>
    </div>
  )
}
