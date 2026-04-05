import { describe, it, expect } from 'vitest'
import { parseCsvString } from '@/lib/utils/csv-parser'

describe('parseCsvString', () => {
  it('parses valid CSV with header and data rows', () => {
    const csv = [
      'name,bias,factuality,ownership,region',
      'Reuters,center,very-high,independent,us',
      'BBC News,center,high,state-funded,uk',
    ].join('\n')

    const result = parseCsvString(csv)

    expect(result.valid).toHaveLength(2)
    expect(result.errors).toHaveLength(0)
    expect(result.totalRows).toBe(2)
    expect(result.valid[0]).toEqual(
      expect.objectContaining({
        name: 'Reuters',
        bias: 'center',
        factuality: 'very-high',
        ownership: 'independent',
        region: 'us',
      })
    )
    expect(result.valid[1]).toEqual(
      expect.objectContaining({
        name: 'BBC News',
        bias: 'center',
        factuality: 'high',
        ownership: 'state-funded',
        region: 'uk',
      })
    )
  })

  it('returns error on row 0 when required headers are missing', () => {
    const csv = [
      'name,url',
      'Reuters,https://reuters.com',
    ].join('\n')

    const result = parseCsvString(csv)

    expect(result.valid).toHaveLength(0)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].row).toBe(0)
    expect(result.errors[0].errors[0]).toContain('Missing required headers')
    expect(result.totalRows).toBe(0)
  })

  it('returns error when CSV has only a header row and no data', () => {
    const csv = 'name,bias,factuality,ownership'

    const result = parseCsvString(csv)

    expect(result.valid).toHaveLength(0)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].row).toBe(0)
    expect(result.errors[0].errors[0]).toContain('header row and at least one data row')
    expect(result.totalRows).toBe(0)
  })

  it('splits valid and invalid rows correctly', () => {
    const csv = [
      'name,bias,factuality,ownership',
      'Reuters,center,very-high,independent',
      ',center,high,corporate',
      'AP News,left,high,non-profit',
    ].join('\n')

    const result = parseCsvString(csv)

    expect(result.valid).toHaveLength(2)
    expect(result.errors).toHaveLength(1)
    expect(result.totalRows).toBe(3)
    expect(result.errors[0].row).toBe(2)
    expect(result.valid[0].name).toBe('Reuters')
    expect(result.valid[1].name).toBe('AP News')
  })

  it('handles quoted fields with commas inside', () => {
    const csv = [
      'name,bias,factuality,ownership',
      '"News Corp, Inc.",right,mixed,corporate',
    ].join('\n')

    const result = parseCsvString(csv)

    expect(result.valid).toHaveLength(1)
    expect(result.errors).toHaveLength(0)
    expect(result.valid[0].name).toBe('News Corp, Inc.')
  })

  it('defaults optional fields when columns are absent', () => {
    const csv = [
      'name,bias,factuality,ownership',
      'Reuters,center,very-high,independent',
    ].join('\n')

    const result = parseCsvString(csv)

    expect(result.valid).toHaveLength(1)
    if (result.valid.length > 0) {
      expect(result.valid[0].region).toBe('us')
      expect(result.valid[0].url).toBeUndefined()
      expect(result.valid[0].rss_url).toBeUndefined()
      expect(result.valid[0].slug).toBeUndefined()
    }
  })

  it('reports accurate totalRows count', () => {
    const csv = [
      'name,bias,factuality,ownership',
      'Reuters,center,very-high,independent',
      ',invalid-bias,bad,bad',
      'BBC,left,high,state-funded',
      'NPR,lean-left,high,non-profit',
      ',,,',
    ].join('\n')

    const result = parseCsvString(csv)

    expect(result.totalRows).toBe(5)
    expect(result.valid.length + result.errors.length).toBe(5)
  })

  it('handles CRLF line endings', () => {
    const csv = 'name,bias,factuality,ownership\r\nReuters,center,very-high,independent\r\n'

    const result = parseCsvString(csv)

    expect(result.valid).toHaveLength(1)
    expect(result.valid[0].name).toBe('Reuters')
  })

  it('ignores blank lines', () => {
    const csv = [
      'name,bias,factuality,ownership',
      '',
      'Reuters,center,very-high,independent',
      '',
      'BBC,left,high,state-funded',
      '',
    ].join('\n')

    const result = parseCsvString(csv)

    expect(result.valid).toHaveLength(2)
    expect(result.totalRows).toBe(2)
  })

  it('handles headers with mixed casing and spaces', () => {
    const csv = [
      'Name,Bias,Factuality,Ownership',
      'Reuters,center,very-high,independent',
    ].join('\n')

    const result = parseCsvString(csv)

    expect(result.valid).toHaveLength(1)
    expect(result.valid[0].name).toBe('Reuters')
  })

  it('includes field-level error details for invalid rows', () => {
    const csv = [
      'name,bias,factuality,ownership',
      'Test Source,invalid-bias,very-high,independent',
    ].join('\n')

    const result = parseCsvString(csv)

    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].row).toBe(1)
    expect(result.errors[0].errors.length).toBeGreaterThan(0)
    expect(result.errors[0].errors[0]).toContain('bias')
  })

  it('returns empty result for completely empty input', () => {
    const result = parseCsvString('')

    expect(result.valid).toHaveLength(0)
    expect(result.errors).toHaveLength(1)
    expect(result.totalRows).toBe(0)
  })

  it('handles all optional columns present', () => {
    const csv = [
      'name,url,rss_url,bias,factuality,ownership,region,slug',
      'Reuters,https://reuters.com,https://reuters.com/rss,center,very-high,independent,international,reuters',
    ].join('\n')

    const result = parseCsvString(csv)

    expect(result.valid).toHaveLength(1)
    expect(result.valid[0]).toEqual({
      name: 'Reuters',
      url: 'https://reuters.com',
      rss_url: 'https://reuters.com/rss',
      bias: 'center',
      factuality: 'very-high',
      ownership: 'independent',
      region: 'international',
      slug: 'reuters',
    })
  })
})
