import Fuse from 'fuse.js'

const DEFAULT_OPTIONS = {
  threshold: 0.36,
  ignoreLocation: true,
  minMatchCharLength: 2,
  includeScore: false,
}

export function fuzzyFilter(items = [], query = '', keys = [], options = {}) {
  const normalizedQuery = String(query || '').trim()
  if (!normalizedQuery) return items
  if (!items.length || !keys.length) return []

  const fuse = new Fuse(items, {
    ...DEFAULT_OPTIONS,
    keys,
    ...options,
  })

  return fuse.search(normalizedQuery).map((result) => result.item)
}
