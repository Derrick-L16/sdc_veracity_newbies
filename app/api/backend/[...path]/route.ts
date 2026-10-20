import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  if (request.method === 'POST') {
    const origin = request.headers.get('origin')
    const expected = process.env.APP_ORIGIN || `${request.nextUrl.protocol}//${request.headers.get('host')}`
    if (!origin || origin !== expected) return NextResponse.json({ error: 'Untrusted request origin.' }, { status: 403 })
  }
  const { path } = await context.params
  if (path.some(p => !/^[a-zA-Z0-9_-]+$/.test(p))) return NextResponse.json({ error: 'Invalid path.' }, { status: 400 })
  try {
    const response = await fetch(`${process.env.BACKEND_URL || 'http://127.0.0.1:8000'}/${path.join('/')}`, {
      method: request.method,
      headers: { 'Content-Type': 'application/json', Cookie: request.headers.get('cookie') || '' },
      body: request.method === 'POST' ? await request.text() : undefined,
      cache: 'no-store', signal: AbortSignal.timeout(15000),
    })
    const headers = new Headers({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
    const cookie = response.headers.get('set-cookie')
    if (cookie) headers.set('Set-Cookie', cookie + (request.nextUrl.protocol === 'https:' ? '; Secure' : ''))
    return new NextResponse(await response.text(), { status: response.status, headers })
  } catch {
    return NextResponse.json({ error: 'Backend unavailable. Start python backend/server.py and retry.' }, { status: 503 })
  }
}
export const GET = proxy
export const POST = proxy
