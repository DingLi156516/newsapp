/**
 * lib/utils/csv-parser.ts — Client-side CSV parsing for source bulk import.
 *
 * Parses CSV text into rows and maps them to source creation inputs.
 * No external dependencies — uses basic string splitting.
 */

import { csvRowSchema, type CsvRowInput } from '@/lib/api/source-admin-validation'

export interface CsvParseError {
  readonly row: number
  readonly errors: string[]
}

export interface CsvParseResult {
  readonly valid: CsvRowInput[]
  readonly errors: CsvParseError[]
  readonly totalRows: number
}

const REQUIRED_HEADERS = ['name', 'bias', 'factuality', 'ownership'] as const
const ALL_HEADERS = ['name', 'url', 'rss_url', 'bias', 'factuality', 'ownership', 'region', 'slug'] as const

function parseCsvLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      fields.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }

  fields.push(current.trim())
  return fields
}

export function parseCsvString(csvText: string): CsvParseResult {
  const lines = csvText
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)

  if (lines.length < 2) {
    return { valid: [], errors: [{ row: 0, errors: ['CSV must have a header row and at least one data row'] }], totalRows: 0 }
  }

  const headerLine = parseCsvLine(lines[0])
  const headers = headerLine.map((h) => h.toLowerCase().replace(/\s+/g, '_'))

  const missingHeaders = REQUIRED_HEADERS.filter((h) => !headers.includes(h))
  if (missingHeaders.length > 0) {
    return {
      valid: [],
      errors: [{ row: 0, errors: [`Missing required headers: ${missingHeaders.join(', ')}`] }],
      totalRows: 0,
    }
  }

  const headerMap = new Map<string, number>()
  for (const header of ALL_HEADERS) {
    const idx = headers.indexOf(header)
    if (idx !== -1) {
      headerMap.set(header, idx)
    }
  }

  const valid: CsvRowInput[] = []
  const errors: CsvParseError[] = []
  const dataLines = lines.slice(1)

  for (let i = 0; i < dataLines.length; i++) {
    const fields = parseCsvLine(dataLines[i])
    const raw: Record<string, string> = {}

    for (const [header, idx] of headerMap.entries()) {
      raw[header] = fields[idx] ?? ''
    }

    const result = csvRowSchema.safeParse(raw)

    if (result.success) {
      valid.push(result.data)
    } else {
      const messages = result.error.issues.map(
        (issue) => `${issue.path.join('.')}: ${issue.message}`
      )
      errors.push({ row: i + 1, errors: messages })
    }
  }

  return { valid, errors, totalRows: dataLines.length }
}
