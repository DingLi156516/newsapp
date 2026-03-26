import Link from 'next/link'
import { HelpCircle } from 'lucide-react'

interface GuideLinkProps {
  readonly section: string
}

export function GuideLink({ section }: GuideLinkProps) {
  return (
    <Link
      href={`/guide#${section}`}
      className="inline-flex items-center justify-center"
      aria-label="Learn more"
      title="Learn more"
    >
      <HelpCircle size={12} className="text-white/30 hover:text-white/60 transition-colors" />
    </Link>
  )
}
