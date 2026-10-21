import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { PDFDocument } from 'pdf-lib'
import { localEvidenceEnabled, localBytes, saveLocalBytes, localExists } from '../src/lib/local-evidence-storage.ts'
import { verifyAndPreserve, removeStaging, EvidenceError } from '../src/lib/evidence-storage.ts'

test('explicit local storage preserves validated immutable files across retries', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'veracity-storage-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  // Assign and restore these explicitly because they may not exist.
  const old = { mode: process.env.VERACITY_STORAGE, dir: process.env.VERACITY_LOCAL_UPLOAD_DIR, node: process.env.NODE_ENV }
  process.env.NODE_ENV = 'development'
  process.env.VERACITY_STORAGE = 'local'
  process.env.VERACITY_LOCAL_UPLOAD_DIR = root
  t.after(() => {
    for (const [key, value] of [['VERACITY_STORAGE', old.mode], ['VERACITY_LOCAL_UPLOAD_DIR', old.dir], ['NODE_ENV', old.node]]) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value
    }
  })
  const pdf = await PDFDocument.create()
  pdf.addPage()
  const bytes = Buffer.from(await pdf.save())
  const id = 'a'.repeat(32)
  const ticket = { id, stagingKey: `evidence-staging/${id}`, objectKey: `case-evidence/${id}`, size: bytes.length, contentType: 'application/pdf' }
  await saveLocalBytes(ticket.stagingKey, bytes)
  await saveLocalBytes(ticket.stagingKey, bytes) // safe resend
  await assert.rejects(saveLocalBytes(ticket.stagingKey, Buffer.from('changed')), /different bytes/)
  const hash = await verifyAndPreserve(ticket)
  assert.match(hash, /^[a-f0-9]{64}$/)
  await removeStaging(ticket)
  assert.equal(await localExists(ticket.stagingKey), false)
  assert.equal(await verifyAndPreserve(ticket), hash) // finalization retry after cleanup
  await saveLocalBytes(ticket.objectKey, Buffer.from('replacement'), true)
  assert.deepEqual(await localBytes(ticket.objectKey, 10_485_760), bytes)
  await assert.rejects(localBytes('../escape', 10), EvidenceError)
  await assert.rejects(localBytes(ticket.objectKey, 1), /exceeds/)
})

test('local mode is never an implicit fallback and is rejected in production', () => {
  const old = { mode: process.env.VERACITY_STORAGE, node: process.env.NODE_ENV }
  try {
    delete process.env.VERACITY_STORAGE
    assert.equal(localEvidenceEnabled(), false)
    process.env.VERACITY_STORAGE = 'local'
    process.env.NODE_ENV = 'production'
    assert.throws(localEvidenceEnabled, /only in development/)
    process.env.NODE_ENV = 'development'
    assert.equal(localEvidenceEnabled(), true)
    process.env.VERACITY_STORAGE = 'typo'
    assert.throws(localEvidenceEnabled, /Unknown/)
  } finally {
    for (const [key, value] of [['VERACITY_STORAGE', old.mode], ['NODE_ENV', old.node]]) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value
    }
  }
})
