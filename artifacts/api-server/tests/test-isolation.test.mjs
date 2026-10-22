import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, rmSync, mkdirSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { assertTestIsolation } from '../src/lib/test-isolation.ts'

test('normal application startup does not require E2E configuration', () => {
  assert.doesNotThrow(() => assertTestIsolation({}))
})

test('E2E startup fails closed unless DB and uploads are fresh and isolated', t => {
  const root = mkdtempSync(path.join(tmpdir(), 'veracity-e2e-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  writeFileSync(path.join(root, 'isolation-token'), 'test-run')
  const valid = {
    VERACITY_E2E: '1', NODE_ENV: 'development', VERACITY_LOCAL_DEV: '1',
    VERACITY_STORAGE: 'local', VERACITY_E2E_ROOT: root, VERACITY_E2E_TOKEN: 'test-run',
    VERACITY_DB: path.join(root, 'test.sqlite3'),
    VERACITY_LOCAL_UPLOAD_DIR: path.join(root, 'evidence'),
  }
  assert.doesNotThrow(() => assertTestIsolation(valid))
  for (const override of [
    { VERACITY_DB: undefined }, { VERACITY_E2E: undefined },
    { NODE_ENV: 'production' }, { VERACITY_STORAGE: 'replit' },
    { VERACITY_E2E_TOKEN: 'other-run' }, { VERACITY_LOCAL_DEV: '0' },
    { VERACITY_DB: path.join(root, '..', 'demo.sqlite3') },
    { VERACITY_LOCAL_UPLOAD_DIR: path.join(root, '..', 'demo-evidence') },
  ]) assert.throws(() => assertTestIsolation({ ...valid, ...override }))
  writeFileSync(valid.VERACITY_DB, 'existing data')
  assert.throws(() => assertTestIsolation(valid))
  rmSync(valid.VERACITY_DB)
  mkdirSync(valid.VERACITY_LOCAL_UPLOAD_DIR)
  assert.throws(() => assertTestIsolation(valid))
  rmSync(valid.VERACITY_LOCAL_UPLOAD_DIR, { recursive: true })
  symlinkSync(path.join(root, 'isolation-token'), valid.VERACITY_DB)
  assert.throws(() => assertTestIsolation(valid))
  rmSync(valid.VERACITY_DB)
  symlinkSync(path.join(root, 'missing-target'), valid.VERACITY_DB)
  assert.throws(() => assertTestIsolation(valid))
})
