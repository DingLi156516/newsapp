'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft, BookOpen } from 'lucide-react'
import {
  ALL_BIASES,
  ALL_FACTUALITIES,
  ALL_OWNERSHIPS,
  OWNERSHIP_LABELS,
} from '@/lib/types'
import { BiasTag } from '@/components/atoms/BiasTag'
import { FactualityBar } from '@/components/atoms/FactualityBar'
import { BlindspotBadge } from '@/components/atoms/BlindspotBadge'
import { CoverageCount } from '@/components/atoms/CoverageCount'
import { UserMenu } from '@/components/organisms/UserMenu'

const OWNERSHIP_DESCRIPTIONS: Record<string, string> = {
  'independent': 'Independently owned, not part of a larger media conglomerate.',
  'corporate': 'Owned by a publicly traded or large private corporation.',
  'non-profit': 'Operated as a non-profit organization, often donor-funded.',
  'state-funded': 'Receives significant funding from a national government.',
  'private-equity': 'Owned or controlled by a private equity firm.',
  'telecom': 'Owned by a telecommunications company.',
  'government': 'Directly operated by a government entity.',
  'other': 'Ownership structure does not fit other categories.',
}

export default function GuidePage() {
  const router = useRouter()

  return (
    <div className="min-h-screen mesh-gradient">
      <div className="mx-auto max-w-3xl px-4 py-6 space-y-6">
        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push('/')}
            className="glass-pill flex items-center gap-1.5 px-3 py-2 text-sm text-white/80 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20"
          >
            <ArrowLeft size={14} />
            Feed
          </button>
          <UserMenu />
        </div>

        {/* Title banner */}
        <div className="glass p-6 space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-white/10 border border-white/10">
              <BookOpen size={20} className="text-white/80" />
            </div>
            <h1
              className="text-3xl font-bold text-white"
              style={{ fontFamily: 'DM Serif Display, Georgia, serif' }}
            >
              Guide
            </h1>
          </div>
          <p className="text-sm text-white/60 leading-relaxed">
            Axiom uses visual indicators to surface bias, factuality, and coverage patterns at a glance. This guide explains what each one means.
          </p>
        </div>

        {/* Section 1: Bias Spectrum */}
        <section id="bias-spectrum" className="glass p-6 space-y-4">
          <p className="text-xs text-white/60 uppercase tracking-widest">Bias Spectrum</p>
          <p className="text-sm text-white/70 leading-relaxed">
            Every story shows its political spectrum — from far left to far right. Each source in our directory is independently rated for political leaning, and we display these as colored indicators throughout the app.
          </p>
          <div className="flex flex-wrap gap-3">
            {ALL_BIASES.map((bias) => (
              <div key={bias} className="flex items-center gap-2">
                <BiasTag bias={bias} label />
              </div>
            ))}
          </div>
          <p className="text-xs text-white/40 leading-relaxed">
            Blue tones indicate left-leaning perspectives, gray indicates center, and red tones indicate right-leaning perspectives.
          </p>
        </section>

        {/* Section 2: Factuality */}
        <section id="factuality" className="glass p-6 space-y-4">
          <p className="text-xs text-white/60 uppercase tracking-widest">Factuality Ratings</p>
          <p className="text-sm text-white/70 leading-relaxed">
            The colored bar shows how factual a source is rated, based on independent fact-checking organizations. A fuller bar in green means higher factuality; a shorter bar in red means lower.
          </p>
          <div className="space-y-3">
            {ALL_FACTUALITIES.map((level) => (
              <div key={level} className="flex items-center gap-3">
                <FactualityBar level={level} showLabel />
              </div>
            ))}
          </div>
        </section>

        {/* Section 3: Blindspots */}
        <section id="blindspots" className="glass p-6 space-y-4">
          <p className="text-xs text-white/60 uppercase tracking-widest">Blindspots</p>
          <p className="text-sm text-white/70 leading-relaxed">
            A blindspot badge appears when a story&apos;s coverage is heavily skewed to one side of the political spectrum — meaning more than 80% of covering sources lean the same direction. These stories may lack balanced perspectives.
          </p>
          <div className="flex items-center gap-3">
            <BlindspotBadge />
            <span className="text-xs text-white/50">Indicates skewed coverage</span>
          </div>
          <p className="text-sm text-white/70 leading-relaxed">
            Your personal blindspot tracking is available in the Dashboard. It analyzes your reading patterns and highlights perspectives you may be missing.
          </p>
        </section>

        {/* Section 4: Coverage */}
        <section id="coverage" className="glass p-6 space-y-4">
          <p className="text-xs text-white/60 uppercase tracking-widest">Coverage &amp; Sources</p>
          <p className="text-sm text-white/70 leading-relaxed">
            The source count shows how many news outlets are covering a story. Higher counts generally indicate a more significant or widely-reported event. Each story clusters articles from multiple outlets into a single unified view.
          </p>
          <div className="flex items-center gap-3">
            <CoverageCount count={12} />
            <span className="text-xs text-white/50">12 outlets covering this story</span>
          </div>
        </section>

        {/* Section 5: Ownership */}
        <section id="ownership" className="glass p-6 space-y-4">
          <p className="text-xs text-white/60 uppercase tracking-widest">Ownership Types</p>
          <p className="text-sm text-white/70 leading-relaxed">
            Who funds a news source can affect its editorial independence. Axiom labels each source with an ownership type so you can factor funding into your assessment.
          </p>
          <div className="space-y-3">
            {ALL_OWNERSHIPS.map((type) => (
              <div key={type} className="glass-sm p-3 space-y-1">
                <p className="text-sm text-white/90 font-medium">{OWNERSHIP_LABELS[type]}</p>
                <p className="text-xs text-white/50 leading-relaxed">{OWNERSHIP_DESCRIPTIONS[type]}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
