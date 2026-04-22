/**
 * components/organisms/SettingsForm.tsx — User preferences form.
 *
 * Renders topic pills, region/perspective/factuality selectors with
 * optimistic auto-save. Uses glass design system tokens.
 */
'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Check } from 'lucide-react'
import { usePreferences } from '@/lib/hooks/use-preferences'
import type { UserPreferences } from '@/lib/hooks/use-preferences'
import { TOPIC_LABELS, FACTUALITY_LABELS } from '@/lib/types'
import type { Topic, PerspectiveFilter, FactualityLevel } from '@/lib/types'
import {
  getTelemetryOptOut,
  setTelemetryOptOut,
} from '@/lib/hooks/use-telemetry-consent'

const PERSPECTIVES: { value: PerspectiveFilter; label: string }[] = [
  { value: 'all', label: 'All Perspectives' },
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' },
]

const FACTUALITY_OPTIONS: { value: FactualityLevel; label: string }[] = [
  { value: 'very-high', label: FACTUALITY_LABELS['very-high'] },
  { value: 'high', label: FACTUALITY_LABELS['high'] },
  { value: 'mixed', label: FACTUALITY_LABELS['mixed'] },
  { value: 'low', label: FACTUALITY_LABELS['low'] },
  { value: 'very-low', label: FACTUALITY_LABELS['very-low'] },
]

const TOPIC_OPTIONS = (Object.entries(TOPIC_LABELS) as [Topic, string][])

export function SettingsForm() {
  const { preferences, updatePreferences, isLoading } = usePreferences()
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [telemetryOptOut, setTelemetryOptOutState] = useState(false)

  useEffect(() => {
    setTelemetryOptOutState(getTelemetryOptOut())
  }, [])

  function handleTelemetryToggle(nextOptOut: boolean) {
    setTelemetryOptOutState(nextOptOut)
    setTelemetryOptOut(nextOptOut)
    setSaveSuccess(true)
    setTimeout(() => setSaveSuccess(false), 2000)
  }

  async function handleTopicToggle(topic: Topic) {
    const current = preferences.followed_topics
    const updated = current.includes(topic)
      ? current.filter((t) => t !== topic)
      : [...current, topic]

    setIsSaving(true)
    try {
      await updatePreferences({ followed_topics: updated })
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 2000)
    } catch {
      // Optimistic update will revert
    } finally {
      setIsSaving(false)
    }
  }

  async function handleChange(updates: Partial<UserPreferences>) {
    setIsSaving(true)
    try {
      await updatePreferences(updates)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 2000)
    } catch {
      // Optimistic update will revert
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="glass p-5 animate-shimmer">
            <div className="h-5 w-32 bg-white/10 rounded mb-4" />
            <div className="h-10 w-full bg-white/10 rounded" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Save indicator */}
      {saveSuccess && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="glass-pill px-3 py-2 text-xs text-green-400 flex items-center gap-1.5 w-fit"
        >
          <Check size={12} />
          Preferences saved
        </motion.div>
      )}

      {/* Followed Topics */}
      <section className="glass p-5 space-y-3">
        <h3 className="text-sm font-medium text-white/80">Followed Topics</h3>
        <p className="text-xs text-white/50">Select topics you want to see highlighted in your feed.</p>
        <div className="flex flex-wrap gap-2">
          {TOPIC_OPTIONS.map(([value, label]) => {
            const isFollowed = preferences.followed_topics.includes(value)
            return (
              <button
                key={value}
                onClick={() => handleTopicToggle(value)}
                disabled={isSaving}
                className={`glass-pill px-3 py-1.5 text-xs transition-colors ${
                  isFollowed
                    ? 'bg-white/20 text-white border border-white/30'
                    : 'text-white/60 hover:text-white/80'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>
      </section>

      {/* Default Perspective */}
      <section className="glass p-5 space-y-3">
        <h3 className="text-sm font-medium text-white/80">Default Perspective</h3>
        <p className="text-xs text-white/50">Choose which political perspective to show by default.</p>
        <div className="flex flex-wrap gap-2">
          {PERSPECTIVES.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => handleChange({ default_perspective: value })}
              disabled={isSaving}
              className={`glass-pill px-3 py-1.5 text-xs transition-colors ${
                preferences.default_perspective === value
                  ? 'bg-white/20 text-white border border-white/30'
                  : 'text-white/60 hover:text-white/80'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* Factuality Minimum */}
      <section className="glass p-5 space-y-3">
        <h3 className="text-sm font-medium text-white/80">Minimum Factuality</h3>
        <p className="text-xs text-white/50">Only show stories from sources at or above this factuality level.</p>
        <div className="flex flex-wrap gap-2">
          {FACTUALITY_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => handleChange({ factuality_minimum: value })}
              disabled={isSaving}
              className={`glass-pill px-3 py-1.5 text-xs transition-colors ${
                preferences.factuality_minimum === value
                  ? 'bg-white/20 text-white border border-white/30'
                  : 'text-white/60 hover:text-white/80'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* Privacy / Engagement Telemetry */}
      <section className="glass p-5 space-y-3" data-testid="telemetry-consent-section">
        <h3 className="text-sm font-medium text-white/80">Anonymous Engagement</h3>
        <p className="text-xs text-white/50">
          Share an opaque, rotating session id with stories you read so the
          feed can surface what other readers find interesting. No IP, no
          User-Agent, no profile is built. Honors Do Not Track.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            data-testid="telemetry-consent-toggle"
            onClick={() => handleTelemetryToggle(!telemetryOptOut)}
            className={`glass-pill px-3 py-1.5 text-xs transition-colors ${
              !telemetryOptOut
                ? 'bg-white/20 text-white border border-white/30'
                : 'text-white/60 hover:text-white/80'
            }`}
          >
            {telemetryOptOut ? 'Sharing disabled' : 'Share anonymous engagement'}
          </button>
        </div>
      </section>

      {/* Email Digest */}
      <section className="glass p-5 space-y-3" data-testid="email-digest-section">
        <h3 className="text-sm font-medium text-white/80">Email Digest</h3>
        <p className="text-xs text-white/50">Receive a weekly email with blindspot stories you may have missed.</p>
        <div className="flex flex-wrap gap-2">
          <button
            data-testid="blindspot-digest-toggle"
            onClick={() => handleChange({ blindspot_digest_enabled: !preferences.blindspot_digest_enabled })}
            disabled={isSaving}
            className={`glass-pill px-3 py-1.5 text-xs transition-colors ${
              preferences.blindspot_digest_enabled
                ? 'bg-white/20 text-white border border-white/30'
                : 'text-white/60 hover:text-white/80'
            }`}
          >
            Weekly Blindspot Digest
          </button>
        </div>
      </section>

    </div>
  )
}
