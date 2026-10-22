// An empty or HTML response means the request never reached the API server
// (for example, Vite was started on its own without the local gateway).
export const API_UNREACHABLE =
  'Could not reach the Veracity API server. In VS Code, run "pnpm local" from the repository root and open http://localhost:3000.'

export async function readJson<T = Record<string, unknown>>(response: Response): Promise<T> {
  const text = await response.text()
  if (!text.trim()) throw Object.assign(new Error(API_UNREACHABLE), { status: response.status })
  try {
    return JSON.parse(text) as T
  } catch {
    throw Object.assign(new Error(API_UNREACHABLE), { status: response.status })
  }
}
