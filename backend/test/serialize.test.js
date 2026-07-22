import { describe, expect, it } from 'vitest'
import mongoose from 'mongoose'
import { deserialize, serialize } from '../src/utils/serialize.js'

describe('deserialize special-object preservation', () => {
  it('preserves Date instances', () => {
    const when = new Date('2026-03-15T10:00:00.000Z')
    expect(deserialize(when)).toBe(when)
    expect(deserialize(when) instanceof Date).toBe(true)
  })

  it('preserves nested Date values under snake_case keys', () => {
    const when = new Date('2026-03-15T10:00:00.000Z')
    const out = deserialize({ valid_from: when })
    expect(out.validFrom).toBe(when)
    expect(out.validFrom instanceof Date).toBe(true)
  })

  it('preserves deeply nested Date values', () => {
    const when = new Date('2026-07-01T00:00:00.000Z')
    const out = deserialize({ nested_date: when, wrapper: { issued_at: when } })
    expect(out.nestedDate instanceof Date).toBe(true)
    expect(out.wrapper.issuedAt instanceof Date).toBe(true)
    expect(out.nestedDate).toBe(when)
    expect(out.wrapper.issuedAt).toBe(when)
  })

  it('preserves Mongo ObjectIds instead of converting them to plain objects', () => {
    const id = new mongoose.Types.ObjectId()
    expect(deserialize(id)).toBe(id)
    expect(typeof deserialize(id).toHexString).toBe('function')

    const wrapped = deserialize({ product_id: id })
    expect(wrapped.productId).toBe(id)
    expect(wrapped.productId.toHexString()).toBe(id.toHexString())
  })

  it('preserves Buffers', () => {
    const buf = Buffer.from('goldex')
    expect(deserialize(buf)).toBe(buf)
    expect(Buffer.isBuffer(deserialize(buf))).toBe(true)

    const wrapped = deserialize({ file_bytes: buf })
    expect(wrapped.fileBytes).toBe(buf)
  })

  it('still converts plain snake_case objects and arrays', () => {
    expect(deserialize({ recipient_name: 'Aisha', is_default: true })).toEqual({
      recipientName: 'Aisha',
      isDefault: true,
    })
    expect(deserialize([{ line_one: 'Marina', is_primary: true }])).toEqual([{
      lineOne: 'Marina',
      isPrimary: true,
    }])
  })
})

describe('serialize round-trip helpers', () => {
  it('serializes Date to ISO and ObjectId to hex', () => {
    const when = new Date('2026-03-15T10:00:00.000Z')
    const id = new mongoose.Types.ObjectId()
    expect(serialize(when)).toBe(when.toISOString())
    expect(serialize(id)).toBe(id.toHexString())
    expect(serialize({ validFrom: when, productId: id })).toEqual({
      valid_from: when.toISOString(),
      product_id: id.toHexString(),
    })
  })
})
