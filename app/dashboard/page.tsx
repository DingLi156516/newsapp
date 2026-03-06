/**
 * app/dashboard/page.tsx — Bias calibration dashboard.
 *
 * Visualizes the user's reading bias distribution, highlights blindspots,
 * and suggests stories from underrepresented perspectives.
 * Requires authentication.
 */
'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft, BarChart3 } from 'lucide-react'
import { useRequireAuth } from '@/lib/hooks/use-require-auth'
import { useBiasProfile } from '@/lib/hooks/use-bias-profile'
import { useSuggestions } from '@/lib/hooks/use-suggestions'
import { UserMenu } from '@/components/organisms/UserMenu'
import { BiasProfileChart } from '@/components/organisms/BiasProfileChart'
import { BiasComparisonBar } from '@/components/molecules/BiasComparisonBar'
import { SuggestionsList } from '@/components/organisms/SuggestionsList'
import { Skeleton } from '@/components/atoms/Skeleton'
import { BIAS_LABELS } from '@/lib/types'

export default function DashboardPage() {
  const router = useRouter()
  useRequireAuth()

  const { profile, isLoading: profileLoading } = useBiasProfile()
  const { suggestions, isLoading: suggestionsLoading } = useSuggestions()

  return (
    <div className="min-h-screen mesh-gradient">
      <div className="mx-auto max-w-3xl px-4 py-6 space-y-6">
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

        {/* Banner */}
        <div className="glass p-5 space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white/10 border border-white/10">
              <BarChart3 size={16} className="text-white/80" />
            </div>
            <h1
              className="text-xl font-bold text-white"
              style={{ fontFamily: 'DM Serif Display, Georgia, serif' }}
            >
              Bias Calibration
            </h1>
          </div>
          <p className="text-sm text-white/70 leading-relaxed">
            Your reading habits shape your worldview. This dashboard shows which
            perspectives you consume most — and which you&apos;re missing.
          </p>
          {profile && (
            <div className="flex items-center gap-3 text-xs text-white/60">
              <span>{profile.totalStoriesRead} stories analyzed</span>
              {profile.blindspots.length > 0 && (
                <>
                  <span>·</span>
                  <span className="text-amber-400">
                    {profile.blindspots.length} blindspot{profile.blindspots.length !== 1 ? 's' : ''} detected
                  </span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Bias profile */}
        {profileLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-64 w-full rounded-[24px]" />
          </div>
        ) : profile ? (
          <>
            {/* Comparison bar */}
            <div className="space-y-2">
              <p className="text-xs text-white/60 uppercase tracking-widest">
                Spectrum Comparison
              </p>
              <BiasComparisonBar
                userDistribution={profile.userDistribution}
                overallDistribution={profile.overallDistribution}
              />
            </div>

            {/* Detailed chart */}
            <div className="space-y-2">
              <p className="text-xs text-white/60 uppercase tracking-widest">
                Detailed Breakdown
              </p>
              <BiasProfileChart profile={profile} />
            </div>

            {/* Blindspots */}
            {profile.blindspots.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-white/60 uppercase tracking-widest">
                  Your Blindspots
                </p>
                <div className="glass p-4 space-y-2">
                  <p className="text-sm text-white/70">
                    You read significantly less from these perspectives compared to the overall distribution:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {profile.blindspots.map((bias) => (
                      <span
                        key={bias}
                        className="glass-pill px-3 py-1.5 text-xs text-amber-400 border border-amber-400/20"
                      >
                        {BIAS_LABELS[bias]}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="glass flex items-center justify-center py-16 text-white/60 text-sm">
            Start reading stories to build your bias profile!
          </div>
        )}

        {/* Suggestions */}
        <div className="space-y-2">
          <p className="text-xs text-white/60 uppercase tracking-widest">
            Suggested For You
          </p>
          <p className="text-xs text-white/40">
            Stories from perspectives you read less often.
          </p>
          <SuggestionsList suggestions={suggestions} isLoading={suggestionsLoading} />
        </div>
      </div>
    </div>
  )
}
