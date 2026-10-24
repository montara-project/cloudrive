import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merge Tailwind CSS classes
 * @param inputs - Class names to merge
 * @returns Merged class names
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Split an app URL ("/storage?org=1&ws=2") into TanStack Router's `to` and
 * `search`: `to` is matched as a path only, so a query string inside it would
 * never reach the page.
 */
export function hrefToLocation(href: string) {
  const [to, query = ''] = href.split('?')
  return { to, search: Object.fromEntries(new URLSearchParams(query)) }
}
