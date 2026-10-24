const UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']

/**
 * FormatBytes renders a byte count with a human unit ("1.9 GB", "847 KB").
 * Values below 1 KB stay in bytes; decimals are trimmed ("2.0 GB" keeps one
 * decimal only when it carries precision).
 */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes)) return '—'
  if (bytes < 0) return '—'

  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024
    unit += 1
  }

  const decimals = value >= 100 || unit === 0 ? 0 : value >= 10 ? 1 : 2
  const rounded = value.toFixed(decimals)
  const trimmed = decimals > 0 ? rounded.replace(/\.?0+$/, '') : rounded

  return `${trimmed} ${UNITS[unit]}`
}
