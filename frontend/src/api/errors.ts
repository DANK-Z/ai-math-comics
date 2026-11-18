export class ApiError extends Error {
  /** HTTP status, or 0 when the server could not be reached. */
  readonly status: number
  /** Machine-readable code from the response body, if any. */
  readonly code: string | null
  /** Human-readable detail from the response body (FastAPI `detail`), if any. */
  readonly detail: string | null
  constructor(status: number, message: string, opts: { code?: string | null; detail?: string | null } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = opts.code ?? null
    this.detail = opts.detail ?? null
  }
}

export function isAbortError(e: unknown): boolean {
  return e instanceof DOMException && e.name === 'AbortError'
}

/** Short technical summary for error UI, e.g. "HTTP 422 · grade must be 5 or 6". */
export function describeError(e: unknown): string {
  if (e instanceof ApiError) {
    const head = e.status === 0 ? 'network' : `HTTP ${e.status}`
    const tail = e.detail ?? e.code
    return tail ? `${head} · ${tail}` : head
  }
  return e instanceof Error ? e.message : String(e)
}
