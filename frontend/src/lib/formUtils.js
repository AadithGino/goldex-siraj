/** Reset dialog form state when opening for create vs edit */
export function toFormState(defaults, entity) {
  if (!entity?.id) return { ...defaults }

  const result = { ...defaults }
  for (const key of Object.keys(defaults)) {
    const value = entity[key]
    result[key] = value === null || value === undefined ? defaults[key] : value
  }
  return result
}

/** Format ISO timestamp for `<input type="date">` */
export function toDateInputValue(value) {
  if (!value) return ''
  return String(value).slice(0, 10)
}

/** Format ISO timestamp for `<input type="datetime-local">` */
export function toDateTimeLocalValue(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 16)
}
