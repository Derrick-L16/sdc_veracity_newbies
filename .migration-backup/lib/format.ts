const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Deterministic formatting (no locale APIs) to keep server and client output identical. */
export function formatDateTime(iso: string) {
  if (!iso) return ''
  const [date, time = '00:00'] = iso.split('T')
  const [, m, d] = date.split('-').map(Number)
  return `${d} ${MONTHS[m - 1]}, ${time.slice(0, 5)}`
}

export function formatDate(iso: string) {
  if (!iso) return ''
  const [y, m, d] = iso.split('T')[0].split('-').map(Number)
  return `${d} ${MONTHS[m - 1]} ${y}`
}

export function formatSigned(n: number) {
  if (n > 0) return `+${n}`
  if (n < 0) return `\u2212${Math.abs(n)}`
  return '0'
}

export function nowIso() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`
}
