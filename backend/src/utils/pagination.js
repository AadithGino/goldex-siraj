/**
 * Normalize page/limit and build list meta with pages.
 * Max page size is capped to protect the API from unbounded scans.
 */
export function parsePagination(query = {}, { defaultLimit = 50, maxLimit = 100 } = {}) {
  const limit = Math.min(Math.max(Number(query.limit) || defaultLimit, 1), maxLimit)
  const page = Math.max(Number(query.page) || 1, 1)
  return { page, limit, skip: (page - 1) * limit }
}

export function paginationMeta(page, limit, total) {
  const safeTotal = Math.max(0, Number(total) || 0)
  return {
    page,
    limit,
    total: safeTotal,
    pages: safeTotal === 0 ? 0 : Math.ceil(safeTotal / limit),
  }
}
