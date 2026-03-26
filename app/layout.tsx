/**
 * app/layout.tsx — Root layout component for the Next.js App Router.
 *
 * In Next.js 13+, the App Router uses a file-system based routing convention.
 * `layout.tsx` files wrap all pages nested below them in the directory tree.
 * This root layout is the outermost shell — every page in the app is rendered
 * inside the `{children}` slot here.
 *
 * Responsibilities:
 *   - Sets the HTML <head> metadata (title, description) for SEO.
 *   - Imports the global CSS file that applies app-wide styles.
 *   - Provides the dark background and base text color for all pages.
 *
 * Note: This is a Server Component by default (no 'use client' directive),
 * so it renders on the server and is never hydrated in the browser.
 */
import type { Metadata } from 'next'
import { AuthProvider } from '@/lib/auth/auth-provider'
import './globals.css'

/**
 * Next.js built-in type for page/layout metadata.
 * These values are injected into the <head> tag at build time.
 * Exporting a `metadata` constant from a layout or page is the App Router
 * equivalent of using next/head from the Pages Router.
 */
export const metadata: Metadata = {
  title: 'Axiom News — See the Full Spectrum',
  description:
    'A high-fidelity news aggregator that dismantles echo chambers through bias visualization, story clustering, and cross-spectrum AI summaries.',
  manifest: '/manifest.json',
}

/**
 * RootLayout wraps every page with a consistent <html> and <body> shell.
 *
 * @param children - The current page component, injected by Next.js routing.
 *   `Readonly<{...}>` is a TypeScript utility that makes all properties
 *   non-reassignable (a good practice for props that should never be mutated).
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    // lang="en" is important for screen readers and SEO.
    <html lang="en">
      {/*
        bg-black:      Sets the page background to pure black.
        text-white:    Default text color for all child elements.
        antialiased:   Enables font smoothing for crisper text rendering on macOS.
        min-h-screen:  Ensures the body is at least the full viewport height
                       (prevents a white gap below content on short pages).
      */}
      <body className="bg-black text-white antialiased min-h-screen">
        <AuthProvider>{children}</AuthProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator){navigator.serviceWorker.register('/service-worker.js')}`,
          }}
        />
      </body>
    </html>
  )
}
