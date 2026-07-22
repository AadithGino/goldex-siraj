function clean(value) {
  if (!value || typeof value !== 'object') return value
  for (const key of Object.keys(value)) {
    if (key.startsWith('$') || key.includes('.')) delete value[key]
    else clean(value[key])
  }
  return value
}

export function sanitize(req, _res, next) {
  clean(req.body)
  clean(req.params)
  clean(req.query)
  next()
}
