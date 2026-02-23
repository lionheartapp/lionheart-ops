export type ApiOk<T> = {
  ok: true
  data: T
  meta?: Record<string, unknown>
}

export type ApiErr = {
  ok: false
  error: {
    code: string
    message: string
    details?: unknown
  }
}

export type ApiResult<T> = ApiOk<T> | ApiErr
