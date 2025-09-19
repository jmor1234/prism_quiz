import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Canonicalize URLs for frontend deduplication and display grouping
// - Lowercase host
// - Remove default ports
// - Drop fragments and common tracking params
// - Collapse duplicate slashes
// - Trim trailing slash (except root)
export function canonicalizeUrlForDedupe(rawUrl: string): string {
  try {
    const u = new URL(rawUrl)
    u.hostname = u.hostname.toLowerCase()
    if ((u.protocol === 'http:' && u.port === '80') || (u.protocol === 'https:' && u.port === '443')) {
      u.port = ''
    }
    u.hash = ''
    const trackingParams = new Set([
      'utm_source','utm_medium','utm_campaign','utm_term','utm_content',
      'gclid','fbclid','ref','ref_src','mc_eid','xtor'
    ])
    const params = u.searchParams
    for (const p of Array.from(params.keys())) {
      if (trackingParams.has(p)) params.delete(p)
    }
    u.pathname = u.pathname.replace(/\/+/, '/')
    if (u.pathname.length > 1 && u.pathname.endsWith('/')) {
      u.pathname = u.pathname.slice(0, -1)
    }
    return u.toString()
  } catch {
    return rawUrl
  }
}
