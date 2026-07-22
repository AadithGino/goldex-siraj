import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/models')

function assertNoDeleteModelsPattern(relativePath) {
  const source = readFileSync(path.join(root, relativePath), 'utf8')
  expect(source).not.toMatch(/if\s*\(\s*models\.\w+\s*\)\s*delete\s+models\.\w+/)
  expect(source).toMatch(/models\.\w+\s*\|\|\s*model\(/)
}

describe('model import-order safety', () => {
  it('commerce.models.js uses models.X || model(...) only', () => {
    assertNoDeleteModelsPattern('commerce.models.js')
  })

  it('scheme.models.js uses models.X || model(...) only', () => {
    assertNoDeleteModelsPattern('scheme.models.js')
  })

  it('re-importing models does not throw OverwriteModelError', async () => {
    await import('../src/models/commerce.models.js')
    await import('../src/models/commerce.models.js')
    await import('../src/models/scheme.models.js')
    await import('../src/models/scheme.models.js')
    const commerce = await import('../src/models/commerce.models.js')
    const scheme = await import('../src/models/scheme.models.js')
    expect(commerce.WalletAccount).toBeTruthy()
    expect(commerce.ReturnRequest).toBeTruthy()
    expect(scheme.SchemeEnrollment).toBeTruthy()
  })
})
