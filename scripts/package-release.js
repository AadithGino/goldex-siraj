#!/usr/bin/env node
/**
 * Deterministic Goldex release packaging with machine-verifiable hygiene scan.
 *
 *   npm run package:release
 *   node scripts/package-release.js --out=dist/goldex-release.zip
 */
import { createHash } from 'node:crypto'
import { createWriteStream, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { cp, mkdir, readdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const STAGING = path.join(ROOT, '.release-staging')

const ALLOWLIST = [
  'backend/package.json',
  'backend/package-lock.json',
  'backend/server.js',
  'backend/eslint.config.js',
  'backend/vitest.config.js',
  'backend/.env.example',
  'backend/src',
  'backend/scripts',
  'backend/test',
  'frontend/package.json',
  'frontend/package-lock.json',
  'frontend/index.html',
  'frontend/vite.config.js',
  'frontend/eslint.config.js',
  'frontend/.env.example',
  'frontend/src',
  'frontend/public',
  'package.json',
  'package-lock.json',
  'README.md',
  'GOLDEX_PRODUCTION_CHANGE_LOG.md',
  'GOLDEX_RELEASE_VERIFICATION.md',
  'GOLDEX_CREDENTIAL_ROTATION.md',
  'GOLDEX_CURSOR_PRODUCTION_REMEDIATION_PROMPT.md',
  'GOLDEX_PHASE_11_15_VERIFICATION.md',
  'GOLDEX_PHASE_16_18_VERIFICATION.md',
  'GOLDEX_PHASE_19_20_VERIFICATION.md',
]

const FORBIDDEN_NAME_RE = /(^|\/)(\.env$|\.env\.|uploads\/|node_modules\/|\.DS_Store$|__MACOSX\/|coverage\/|\.log$)/

function parseOut(argv) {
  const raw = argv.find((a) => a.startsWith('--out='))
  return raw ? path.resolve(ROOT, raw.slice(6)) : path.join(ROOT, 'dist', 'goldex-release.zip')
}

async function listFiles(dir, base = dir, acc = []) {
  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) await listFiles(full, base, acc)
    else acc.push(path.relative(base, full).split(path.sep).join('/'))
  }
  return acc
}

function assertHygiene(files) {
  const counts = {
    env: 0,
    envExample: 0,
    uploads: 0,
    nodeModules: 0,
    dsStore: 0,
    macosx: 0,
  }
  const forbidden = []
  for (const file of files) {
    if (file === '.env' || file.endsWith('/.env') || /(^|\/)\.env\.[^/]+$/.test(file) && !file.includes('.env.example')) {
      counts.env += 1
      forbidden.push(file)
    }
    if (file.endsWith('.env.example') || file === '.env.example') counts.envExample += 1
    if (file.includes('/uploads/') || file.startsWith('uploads/')) {
      counts.uploads += 1
      forbidden.push(file)
    }
    if (file.includes('node_modules/')) {
      counts.nodeModules += 1
      forbidden.push(file)
    }
    if (file.endsWith('.DS_Store')) {
      counts.dsStore += 1
      forbidden.push(file)
    }
    if (file.includes('__MACOSX')) {
      counts.macosx += 1
      forbidden.push(file)
    }
    if (FORBIDDEN_NAME_RE.test(file) && !file.endsWith('.env.example')) {
      if (!forbidden.includes(file)) forbidden.push(file)
    }
  }

  const requiredDocs = [
    'GOLDEX_PRODUCTION_CHANGE_LOG.md',
    'GOLDEX_RELEASE_VERIFICATION.md',
    'GOLDEX_CREDENTIAL_ROTATION.md',
    'GOLDEX_PHASE_19_20_VERIFICATION.md',
  ]
  const missingDocs = requiredDocs.filter((doc) => !files.includes(doc))

  const errors = []
  if (counts.env !== 0) errors.push(`.env count=${counts.env} (must be 0)`)
  if (counts.envExample < 2) errors.push(`.env.example count=${counts.envExample} (need backend+frontend)`)
  if (counts.uploads !== 0) errors.push(`uploads count=${counts.uploads} (must be 0)`)
  if (counts.nodeModules !== 0) errors.push(`node_modules count=${counts.nodeModules} (must be 0)`)
  if (counts.dsStore !== 0) errors.push(`.DS_Store count=${counts.dsStore} (must be 0)`)
  if (counts.macosx !== 0) errors.push(`__MACOSX count=${counts.macosx} (must be 0)`)
  if (missingDocs.length) errors.push(`missing docs: ${missingDocs.join(', ')}`)
  if (forbidden.length) errors.push(`forbidden entries: ${forbidden.slice(0, 20).join(', ')}`)

  return { counts, missingDocs, forbidden, errors }
}

async function copyAllowlisted() {
  await rm(STAGING, { recursive: true, force: true })
  await mkdir(STAGING, { recursive: true })

  for (const entry of ALLOWLIST) {
    const src = path.join(ROOT, entry)
    if (!existsSync(src)) {
      if (entry.startsWith('GOLDEX_') && entry.endsWith('.md')) {
        // Doc may be created in the same release pass; skip missing optional historical docs
        if (entry.includes('PHASE_11') || entry.includes('PHASE_16') || entry.includes('CURSOR')) continue
      }
      throw new Error(`Allowlist entry missing: ${entry}`)
    }
    const dest = path.join(STAGING, entry)
    await mkdir(path.dirname(dest), { recursive: true })
    const st = statSync(src)
    if (st.isDirectory()) await cp(src, dest, { recursive: true })
    else await cp(src, dest)
  }
}

function zipStaging(outFile) {
  mkdirSync(path.dirname(outFile), { recursive: true })
  if (existsSync(outFile)) rmSync(outFile)
  const result = spawnSync('zip', ['-r', '-X', outFile, '.'], {
    cwd: STAGING,
    encoding: 'utf8',
  })
  if (result.status !== 0) {
    throw new Error(`zip failed: ${result.stderr || result.stdout}`)
  }
}

async function main() {
  const outFile = parseOut(process.argv.slice(2))
  console.log(JSON.stringify({ phase: 'copy', root: ROOT }, null, 2))
  await copyAllowlisted()

  const files = await listFiles(STAGING)
  const hygiene = assertHygiene(files)
  if (hygiene.errors.length) {
    console.error(JSON.stringify({ ok: false, hygiene }, null, 2))
    await rm(STAGING, { recursive: true, force: true })
    process.exit(1)
  }

  zipStaging(outFile)

  // Re-scan zip listing
  const listed = spawnSync('zipinfo', ['-1', outFile], { encoding: 'utf8' })
  const zipFiles = (listed.stdout || '').split('\n').map((s) => s.trim()).filter(Boolean)
  const zipHygiene = assertHygiene(zipFiles)
  if (zipHygiene.errors.length) {
    console.error(JSON.stringify({ ok: false, zipHygiene }, null, 2))
    process.exit(1)
  }

  const buf = readFileSync(outFile)
  const sha256 = createHash('sha256').update(buf).digest('hex')
  writeFileSync(`${outFile}.sha256`, `${sha256}  ${path.basename(outFile)}\n`)

  await rm(STAGING, { recursive: true, force: true })

  console.log(JSON.stringify({
    ok: true,
    archive: outFile,
    bytes: buf.length,
    sha256,
    fileCount: zipFiles.length,
    hygiene: zipHygiene.counts,
  }, null, 2))
}

main().catch(async (error) => {
  console.error(JSON.stringify({ ok: false, error: error.message }))
  try { await rm(STAGING, { recursive: true, force: true }) } catch { /* ignore */ }
  process.exit(1)
})
