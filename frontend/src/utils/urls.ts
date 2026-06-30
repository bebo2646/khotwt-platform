/**
 * Forces HTTP URLs to HTTPS to prevent Mixed Content warnings.
 */
export const ensureHttps = (url?: string): string => {
  if (!url) return ''
  if (url.startsWith('http://')) {
    return url.replace('http://', 'https://')
  }
  return url
}
