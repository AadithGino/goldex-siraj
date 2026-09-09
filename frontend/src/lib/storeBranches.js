function newBranchKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `branch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function emptyStoreBranch(overrides = {}) {
  return {
    _key: newBranchKey(),
    name: '',
    name_ar: '',
    line1: '',
    line2: '',
    city: '',
    emirate: 'Dubai',
    country: 'United Arab Emirates',
    phone: '',
    hours: '',
    hours_ar: '',
    maps_url: '',
    is_primary: false,
    ...overrides,
  }
}

function asAddressObject(address) {
  if (!address) return {}
  if (typeof address === 'string') return { line1: address }
  return address
}

/** Storefront + admin: prefer `branches`, fall back to the legacy single address. */
export function normalizeStoreBranches(row = {}) {
  const list = Array.isArray(row.branches) ? row.branches : []
  const fromBranches = list
    .map((branch) => ({
      ...emptyStoreBranch(),
      id: branch.id || branch._id || '',
      name: branch.name || '',
      name_ar: branch.name_ar || '',
      line1: branch.line1 || '',
      line2: branch.line2 || '',
      city: branch.city || '',
      emirate: branch.emirate || '',
      country: branch.country || 'United Arab Emirates',
      phone: branch.phone || '',
      hours: branch.hours || '',
      hours_ar: branch.hours_ar || '',
      maps_url: branch.maps_url || '',
      is_primary: Boolean(branch.is_primary),
    }))
    .filter((branch) => branch.name.trim() || branch.line1.trim())

  if (fromBranches.length) {
    if (!fromBranches.some((branch) => branch.is_primary)) {
      fromBranches[0].is_primary = true
    }
    return fromBranches
  }

  const address = asAddressObject(row.address)
  if (address.line1 || address.city || address.emirate) {
    return [
      emptyStoreBranch({
        name: row.store_name || 'Flagship',
        line1: address.line1 || '',
        line2: address.line2 || '',
        city: address.city || '',
        emirate: address.emirate || address.state || '',
        country: address.country || 'United Arab Emirates',
        is_primary: true,
      }),
    ]
  }

  return []
}

export function toStoreBranchesPayload(branches = []) {
  const cleaned = branches
    .map((branch) => ({
      name: String(branch.name || '').trim(),
      name_ar: String(branch.name_ar || '').trim(),
      line1: String(branch.line1 || '').trim(),
      line2: String(branch.line2 || '').trim(),
      city: String(branch.city || '').trim(),
      emirate: String(branch.emirate || '').trim(),
      country: String(branch.country || 'United Arab Emirates').trim(),
      phone: String(branch.phone || '').trim(),
      hours: String(branch.hours || '').trim(),
      hours_ar: String(branch.hours_ar || '').trim(),
      maps_url: String(branch.maps_url || '').trim(),
      is_primary: Boolean(branch.is_primary),
    }))
    .filter((branch) => branch.name)

  if (cleaned.length && !cleaned.some((branch) => branch.is_primary)) {
    cleaned[0].is_primary = true
  }

  return cleaned
}

export function primaryAddressFromBranches(branches = []) {
  const primary = branches.find((branch) => branch.is_primary) || branches[0]
  if (!primary) return null
  return {
    line1: primary.line1 || '',
    line2: primary.line2 || '',
    city: primary.city || '',
    emirate: primary.emirate || '',
    country: primary.country || 'United Arab Emirates',
  }
}

export function formatBranchAddressLines(branch = {}) {
  const lines = [branch.line1, branch.line2].filter((line) => String(line || '').trim())
  const locality = [branch.city, branch.emirate]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .filter((part, index, all) => all.findIndex((item) => item.toLowerCase() === part.toLowerCase()) === index)
  const country = String(branch.country || '').trim()
  if (locality.length) lines.push(locality.join(', '))
  if (country && country.toLowerCase() !== (locality[locality.length - 1] || '').toLowerCase()) {
    lines.push(country)
  }
  return lines
}

export function branchMapsUrl(branch = {}) {
  const custom = String(branch.maps_url || '').trim()
  if (/^https?:\/\//i.test(custom)) return custom
  const query = formatBranchAddressLines(branch).join(', ')
  if (!query) return null
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}
