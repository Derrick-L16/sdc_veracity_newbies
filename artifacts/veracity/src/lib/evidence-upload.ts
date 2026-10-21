const API = '/api/evidence/cases'

async function post<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, { method: 'POST', credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Upload failed. Retry with the same file.')
  return data as T
}

export interface UploadAttempt {
  requestKey: string
  id?: string
  transferred?: boolean
}

export async function uploadEvidence(caseId: string, version: number, file: File, description: string,
  attempt: UploadAttempt, onProgress: (progress: number, phase: string) => void) {
  const base = `${API}/${encodeURIComponent(caseId)}/uploads`
  onProgress(0, 'Preparing private upload…')
  if (!attempt.id) {
    const ticket = await post<{ id: string; uploadURL?: string; finalized: boolean }>(base, {
      requestKey: attempt.requestKey, filename: file.name, contentType: file.type, size: file.size, description, version,
    })
    attempt.id = ticket.id
    if (ticket.finalized) attempt.transferred = true
    if (!ticket.finalized) {
      if (!ticket.uploadURL) throw new Error('Private upload is unavailable. Please retry.')
      // Keep the ID only after transfer; otherwise a retry requests a fresh signed URL.
      try {
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest()
          xhr.open('PUT', ticket.uploadURL!)
          xhr.setRequestHeader('Content-Type', file.type)
          xhr.timeout = 120000
          xhr.upload.onprogress = e => { if (e.lengthComputable) onProgress(Math.round(e.loaded / e.total * 90), 'Uploading file…') }
          xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error('File transfer failed. Check your connection and retry the same file.'))
          xhr.onerror = xhr.ontimeout = () => reject(new Error('File transfer interrupted. Check your connection and retry the same file.'))
          xhr.send(file)
        })
        attempt.transferred = true
      } catch (error) { attempt.id = undefined; throw error }
    }
  }
  onProgress(95, 'Verifying and saving evidence…')
  await post(`${base}/${attempt.id}/finalize`)
  onProgress(100, 'Evidence saved.')
}

export function attachmentURL(caseId: string, attachmentId: string, version?: number) {
  return `${API}/${encodeURIComponent(caseId)}/attachments/${encodeURIComponent(attachmentId)}${version === undefined ? '' : `?version=${version}`}`
}
