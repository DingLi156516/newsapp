/**
 * components/organisms/AdminSourceImport.tsx — Right panel: CSV upload → preview → import flow.
 *
 * Three-step flow: upload CSV file → preview valid/invalid rows → confirm import.
 */
'use client'

import { useState, useCallback, useRef } from 'react'
import { Upload, X, AlertTriangle, CheckCircle, FileText } from 'lucide-react'
import { parseCsvString, type CsvParseResult } from '@/lib/utils/csv-parser'
import { useImportSources } from '@/lib/hooks/use-admin-sources'

interface Props {
  readonly onImported: () => void
  readonly onCancel: () => void
}

export function AdminSourceImport({ onImported, onCancel }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [parseResult, setParseResult] = useState<CsvParseResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [importResult, setImportResult] = useState<{
    inserted: number
    skipped: number
    errors: { row: number; reason: string }[]
  } | null>(null)
  const { importSources, isImporting } = useImportSources()

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)
    setParseResult(null)
    setImportResult(null)

    if (!file.name.endsWith('.csv')) {
      setError('Please select a CSV file')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      const result = parseCsvString(text)
      setParseResult(result)
    }
    reader.onerror = () => {
      setError('Failed to read file')
    }
    reader.readAsText(file)
  }, [])

  const handleImport = useCallback(async () => {
    if (!parseResult || parseResult.valid.length === 0) return

    setError(null)
    try {
      const result = await importSources({ rows: parseResult.valid })
      setImportResult(result.data)
      if (result.data.inserted > 0) {
        onImported()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    }
  }, [parseResult, importSources, onImported])

  const handleReset = useCallback(() => {
    setParseResult(null)
    setImportResult(null)
    setError(null)
    if (fileRef.current) {
      fileRef.current.value = ''
    }
  }, [])

  return (
    <div className="glass overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <h2 className="text-base font-semibold text-white">Import Sources</h2>
        <button
          onClick={onCancel}
          className="glass-pill flex items-center gap-1 px-3 py-1.5 text-xs text-white/70 hover:text-white"
        >
          <X size={12} />
          Cancel
        </button>
      </div>

      {error && (
        <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/20 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="p-4 space-y-4">
        {/* Import result */}
        {importResult && (
          <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle size={16} className="text-green-400" />
              <p className="text-sm text-white font-medium">Import Complete</p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="text-green-400">{importResult.inserted} inserted</span>
              {importResult.skipped > 0 && (
                <span className="text-amber-400">{importResult.skipped} skipped (duplicates)</span>
              )}
              {importResult.errors.length > 0 && (
                <span className="text-red-400">{importResult.errors.length} errors</span>
              )}
            </div>
            {importResult.errors.length > 0 && (
              <div className="space-y-1 max-h-32 overflow-y-auto scrollbar-hide">
                {importResult.errors.map((err, i) => (
                  <p key={i} className="text-[11px] text-red-400/70">
                    Row {err.row + 1}: {err.reason}
                  </p>
                ))}
              </div>
            )}
            <button
              onClick={handleReset}
              className="glass-pill px-3 py-1.5 text-xs text-white/70 hover:text-white"
            >
              Import another file
            </button>
          </div>
        )}

        {/* File upload */}
        {!importResult && !parseResult && (
          <>
            <div className="border-2 border-dashed border-white/10 rounded-xl p-8 text-center space-y-3">
              <Upload size={24} className="mx-auto text-white/30" />
              <p className="text-sm text-white/50">Select a CSV file to import sources</p>
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="glass-pill px-4 py-2 text-sm text-white/70 hover:text-white"
              >
                Choose File
              </button>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-xs text-white/50">
                <FileText size={12} />
                Required CSV headers
              </div>
              <p className="text-[11px] text-white/40 font-mono">
                name, bias, factuality, ownership
              </p>
              <p className="text-[11px] text-white/30">
                Optional: url, rss_url, region, slug
              </p>
              <p className="text-[11px] text-white/30">
                Valid bias values: far-left, left, lean-left, center, lean-right, right, far-right
              </p>
            </div>
          </>
        )}

        {/* Preview */}
        {parseResult && !importResult && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="flex items-center gap-4 text-xs">
              <span className="text-green-400">{parseResult.valid.length} valid rows</span>
              {parseResult.errors.length > 0 && (
                <span className="text-red-400">{parseResult.errors.length} errors</span>
              )}
              <span className="text-white/40">{parseResult.totalRows} total</span>
            </div>

            {/* Errors */}
            {parseResult.errors.length > 0 && (
              <div className="bg-red-500/5 border border-red-500/10 rounded-lg p-3 space-y-1 max-h-40 overflow-y-auto scrollbar-hide">
                <div className="flex items-center gap-1.5 text-xs text-red-400 mb-1">
                  <AlertTriangle size={12} />
                  Validation errors (these rows will be skipped)
                </div>
                {parseResult.errors.map((err, i) => (
                  <p key={i} className="text-[11px] text-red-400/70">
                    Row {err.row}: {err.errors.join(', ')}
                  </p>
                ))}
              </div>
            )}

            {/* Valid rows preview */}
            {parseResult.valid.length > 0 && (
              <div className="bg-white/5 border border-white/10 rounded-lg overflow-hidden">
                <div className="max-h-64 overflow-y-auto scrollbar-hide">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="border-b border-white/10 text-white/40 uppercase tracking-wide">
                        <th className="text-left p-2">Name</th>
                        <th className="text-left p-2">Bias</th>
                        <th className="text-left p-2">Factuality</th>
                        <th className="text-left p-2">Ownership</th>
                        <th className="text-left p-2">Region</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {parseResult.valid.slice(0, 20).map((row, i) => (
                        <tr key={i} className="text-white/70">
                          <td className="p-2 font-medium">{row.name}</td>
                          <td className="p-2">{row.bias}</td>
                          <td className="p-2">{row.factuality}</td>
                          <td className="p-2">{row.ownership}</td>
                          <td className="p-2">{row.region}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {parseResult.valid.length > 20 && (
                  <p className="text-[11px] text-white/30 p-2 border-t border-white/5">
                    ... and {parseResult.valid.length - 20} more rows
                  </p>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleImport}
                disabled={isImporting || parseResult.valid.length === 0}
                className="glass-pill flex items-center gap-2 px-4 py-2 text-sm text-amber-400 hover:text-amber-300 disabled:opacity-50"
              >
                <Upload size={14} />
                {isImporting ? 'Importing...' : `Import ${parseResult.valid.length} sources`}
              </button>
              <button
                onClick={handleReset}
                className="glass-pill px-3 py-1.5 text-xs text-white/50 hover:text-white"
              >
                Start over
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
