/**
 * components/organisms/SearchBar.tsx — Controlled text input for searching articles.
 *
 * A styled search box that:
 *   - Shows a search icon (absolutely positioned on the left, pointer-events-none
 *     so it doesn't block the text input).
 *   - Renders a clear (×) button on the right when there is typed text.
 *
 * This is a fully controlled input: `value` and `onChange` are owned by the parent.
 * The component does not buffer or debounce input — every keystroke triggers onChange
 * which updates the parent's search state, which triggers the filtered memo to recompute.
 * For large datasets you'd want to add debounce here to avoid filtering on every keystroke.
 *
 * The `type="search"` HTML attribute adds semantic meaning and gives mobile browsers
 * hints to show a search keyboard with a "Search" submit key.
 */
'use client'

import { Search, X } from 'lucide-react'

interface Props {
  value: string
  onChange: (v: string) => void   // Called on every keystroke
  onClear: () => void             // Called when the × button is clicked (resets value to '')
  placeholder?: string            // Optional override for the default placeholder text
}

export function SearchBar({
  value,
  onChange,
  onClear,
  placeholder = 'Search stories, topics, sources…',
}: Props) {
  return (
    <div className="relative flex items-center glass-sm">
      {/* Search icon: absolutely positioned so it overlaps the input's left padding.
          `pointer-events-none` ensures clicks pass through to the input below it. */}
      <Search
        size={15}
        className="absolute left-3.5 text-white/60 pointer-events-none"
        aria-hidden="true"
      />
      <input
        type="search"
        data-testid="search-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}  // Lift state up to parent on every change
        placeholder={placeholder}
        // pl-10: left padding accommodates the search icon (avoids text overlap)
        // pr-10: right padding accommodates the clear button
        className="w-full bg-transparent py-2.5 pl-10 pr-10 text-sm text-white placeholder-white/30 focus:outline-none focus-visible:ring-1 focus-visible:ring-white/20 rounded-[12px]"
        style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
        aria-label="Search stories"
      />
      {/* Clear button — only rendered when there is text typed (avoids showing × on empty input) */}
      {value.length > 0 && (
        <button
          onClick={onClear}
          className="absolute right-3.5 text-white/60 hover:text-white/80 transition-colors"
          aria-label="Clear search"
        >
          <X size={14} />
        </button>
      )}
    </div>
  )
}
