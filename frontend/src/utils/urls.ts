/**
 * Forces HTTP URLs to HTTPS to prevent Mixed Content warnings.
 */
export const ensureHttps = (url?: string): string => {
  if (!url) return ''
  return url.replace(/^http:\/\//i, "https://")
}
