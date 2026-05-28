export function toTableRequestResult<T>(data: T[]) {
  return {
    data,
    success: true,
    total: data.length,
  }
}
