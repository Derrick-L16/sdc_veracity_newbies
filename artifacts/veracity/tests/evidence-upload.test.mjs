import { test } from 'node:test'
import assert from 'node:assert/strict'
import { uploadEvidence } from '../src/lib/evidence-upload.ts'

const file = new File(['test'], 'report.pdf', { type: 'application/pdf' })
const upload = () => uploadEvidence('test-case', 1, file, '', { requestKey: 'test-key' }, () => {})

test('HTML from an old or misrouted API gives an actionable error', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('<!DOCTYPE html><pre>Cannot POST</pre>', {
    status: 404, headers: { 'content-type': 'text/html; charset=utf-8' },
  }))
  await assert.rejects(upload(), /app server needs restarting/)
})

test('JSON API validation messages are preserved', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ error: 'This case is already closed.' }, { status: 409 }))
  await assert.rejects(upload(), /This case is already closed/)
})

test('malformed JSON has a retry-safe error instead of a parser exception', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('{', { headers: { 'content-type': 'application/json' } }))
  await assert.rejects(upload(), /invalid response.*same file/)
})

test('already finalized retries still complete without retransferring the file', async (t) => {
  const paths = []
  t.mock.method(globalThis, 'fetch', async (url) => {
    paths.push(url)
    return Response.json(paths.length === 1 ? { id: 'existing', finalized: true } : { id: 'existing' })
  })
  await upload()
  assert.deepEqual(paths, ['/api/evidence/cases/test-case/uploads', '/api/evidence/cases/test-case/uploads/existing/finalize'])
})
