const TRAILING_JUNK_PATTERN = /[?!.]+$/g

export function cleanDateValue(value: string): string {
  return value.trim().replace(TRAILING_JUNK_PATTERN, '').trim()
}

export function isValidDate(value: Date): boolean {
  return !Number.isNaN(value.getTime())
}

export function parseBestEffortDate(value: string): Date | null {
  const cleaned = cleanDateValue(value)

  if (!cleaned) {
    return null
  }

  const direct = new Date(cleaned)
  if (isValidDate(direct)) {
    return direct
  }

  const normalized = cleaned
    .replace(/\./g, '/')
    .replace(/-/g, '/')
    .replace(/\s+/g, ' ')

  const fallback = new Date(normalized)
  return isValidDate(fallback) ? fallback : null
}

export function formatDisplayDate(date: Date | null, rawDate: string): string {
  if (!date) {
    return rawDate || 'Unknown date'
  }

  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date)
}
