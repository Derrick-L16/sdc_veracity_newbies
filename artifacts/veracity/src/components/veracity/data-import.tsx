import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useApp, useUnsavedWork } from '@/components/app/app-provider'
import { Button } from '@/components/ui/button'
import { Card } from './primitives'

// RFC 4180-style quoted fields, commas, CRLF and multiline cells.
function parseCSV(source: string): Record<string, string>[] {
  const rows: string[][] = []; let row: string[] = []; let cell = ''; let quoted = false
  source = source.replace(/^\uFEFF/, '')
  for (let i = 0; i < source.length; i++) {
    const ch = source[i]
    if (ch === '"') { if (quoted && source[i + 1] === '"') { cell += '"'; i++ } else quoted = !quoted }
    else if (ch === ',' && !quoted) { row.push(cell); cell = '' }
    else if ((ch === '\n' || ch === '\r') && !quoted) { if (ch === '\r' && source[i+1] === '\n') i++; row.push(cell); if (row.some(x => x.trim())) rows.push(row); row = []; cell = '' }
    else cell += ch
  }
  if (quoted) throw new Error('CSV has an unclosed quoted field.')
  row.push(cell); if (row.some(x => x.trim())) rows.push(row)
  const headers = rows.shift()?.map(x => x.trim())
  if (!headers?.length || new Set(headers).size !== headers.length) throw new Error('CSV requires unique column headers.')
  return rows.map(r => { if (r.length !== headers.length) throw new Error('CSV row has the wrong number of columns.'); return Object.fromEntries(headers.map((h,i) => [h,r[i].trim()])) })
}
export function DataImport({ onStateChange }: { onStateChange?: (state: { dirty: boolean; busy: boolean }) => void }) {
  const { role, refresh } = useApp()
  const [kind, setKind] = useState('products')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [fileError, setFileError] = useState('')
  const selectFile = (files: File[]) => {
    if (busy || !files.length) return
    setFile(null)
    if (files.length !== 1 || !files[0].name.toLowerCase().endsWith('.csv')) {
      setFileError('Choose one CSV file.'); return
    }
    if (files[0].size === 0 || files[0].size > 1500000) {
      setFileError('Choose a nonempty CSV no larger than 1.5 MB.'); return
    }
    setFileError(''); setFile(files[0])
  }
  useUnsavedWork(role === 'manager' && (Boolean(file) || busy))
  useEffect(() => {
    onStateChange?.({ dirty: role === 'manager' && Boolean(file), busy })
  }, [file, busy, role, onStateChange])
  if (role !== 'manager') return null
  const upload = async () => {
    if (!file || busy) return
    setBusy(true)
    try {
      if (file.size > 1500000) throw new Error('Use a CSV smaller than 1.5 MB.')
      const rows = parseCSV(await file.text()).map(row => {
        const fields = kind === 'products' ? ['recorded', 'unit_cost'] : ['quantity']
        return Object.fromEntries(Object.entries(row).map(([k,v]) => [k,fields.includes(k) ? (v === '' ? null : Number(v)) : v]))
      })
      const response = await fetch('/api/backend/imports', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ kind, rows }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      await refresh(); toast.success(`Imported ${result.imported} records.`)
      setFile(null)
      if (inputRef.current) inputRef.current.value = '' 
    } catch (e) { toast.error((e as Error).message) }
    finally { setBusy(false) }
  }
  return <Card className="flex flex-col gap-4 p-5">
    <h2 className="text-h3 font-semibold">Connected records</h2>
    <p className="text-body-sm text-fg-secondary">Import your inventory first, then unposted movements. Imports add records; they never overwrite stock. This is a local CSV connector, not a live Orbyte connection.</p>
    <select aria-label="Import type" className="h-12 rounded-[12px] border border-line bg-elevated px-4" value={kind} disabled={busy} onChange={e => { setKind(e.target.value); setFile(null); setFileError(''); if (inputRef.current) inputRef.current.value = '' }}><option value="products">Inventory products</option><option value="movements">Unposted stock movements</option></select>
    <p className="break-all text-caption text-fg-secondary">{kind === 'products' ? 'Headers: id,name,recorded,unit_cost' : 'Headers: id,product_id,kind,quantity,occurred_at,conflict_ref'}</p>
    <input ref={inputRef} type="file" accept=".csv,text/csv" aria-label="CSV records" disabled={busy} hidden onChange={e => { selectFile(Array.from(e.target.files || [])); e.target.value = '' }} />
    <button
      type="button"
      disabled={busy}
      onClick={() => inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); if (!busy) { e.dataTransfer.dropEffect = 'copy'; setDragging(true) } }}
      onDragLeave={e => { if (!(e.relatedTarget instanceof Node) || !e.currentTarget.contains(e.relatedTarget)) setDragging(false) }}
      onDrop={e => { e.preventDefault(); setDragging(false); selectFile(Array.from(e.dataTransfer.files)) }}
      className={`flex min-h-20 w-full items-center justify-center gap-2 rounded-[12px] border border-dashed px-4 py-4 text-body-sm transition-colors disabled:opacity-50 ${dragging ? 'border-accent-text bg-elevated' : 'border-line bg-elevated hover:border-accent-text'}`}
      aria-describedby="csv-file-help"
    >
      {file ? <span className="min-w-0 break-all">{file.name} · <span className="underline underline-offset-4">Change file</span></span> : <span>Drop CSV here or <span className="font-medium underline underline-offset-4">Browse</span></span>}
    </button>
    <p id="csv-file-help" className="text-caption text-fg-secondary" aria-live="polite">{fileError || (file ? 'Ready to import. Click Import records below.' : 'One CSV file · Up to 1.5 MB')}</p>
    <Button disabled={!file || busy} onClick={upload}>{busy ? 'Importing…' : 'Import records'}</Button>
  </Card>
}