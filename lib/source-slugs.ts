interface SourceSlugInput {
  slug?: string | null
  name: string
}

export function normalizeSourceSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function getSourceSlug(source: SourceSlugInput): string {
  if (source.slug && source.slug.trim().length > 0) {
    return source.slug
  }

  return normalizeSourceSlug(source.name)
}
