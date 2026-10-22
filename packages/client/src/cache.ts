const CACHE_PREFIX = 'rycorn:page-cache:v1:'

export function readPageCache<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(`${CACHE_PREFIX}${key}`)
    if (!raw) return fallback
    const entry = JSON.parse(raw) as { value?: T }
    return entry.value ?? fallback
  } catch {
    return fallback
  }
}

export function writePageCache<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify({ savedAt: Date.now(), value }))
  } catch {
    // Storage can be disabled or full; live data still renders normally.
  }
}
