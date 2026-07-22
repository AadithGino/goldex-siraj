const snake = (key) => key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)

function isObjectIdLike(value) {
  return Boolean(value && typeof value === 'object' && typeof value.toHexString === 'function')
}

export function serialize(value) {
  if (value == null) return value
  if (Array.isArray(value)) return value.map(serialize)
  if (value instanceof Date) return value.toISOString()
  if (isObjectIdLike(value)) return value.toHexString()
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) return value
  if (value instanceof Map) return Object.fromEntries([...value.entries()].map(([key, item]) => [key, serialize(item)]))
  if (typeof value?.toObject === 'function') return serialize(value.toObject({ virtuals: false, versionKey: false }))
  if (typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).filter(([key]) => key !== '__v' && key !== 'passwordHash' && key !== 'tokenVersion').map(([key, item]) => [key === '_id' ? 'id' : snake(key), serialize(item)]))
}

const camel = (key) => key.replace(/_([a-z])/g, (_match, letter) => letter.toUpperCase())

/**
 * Convert snake_case plain objects to camelCase for Mongoose services.
 * Preserves Date, ObjectId-like values, and Buffers (does not recurse into them).
 */
export function deserialize(value) {
  if (value == null || typeof value !== 'object') return value
  if (value instanceof Date) return value
  if (isObjectIdLike(value)) return value
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) return value
  if (Array.isArray(value)) return value.map(deserialize)
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [camel(key), deserialize(item)]))
}
