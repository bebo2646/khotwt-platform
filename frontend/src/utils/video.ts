/**
 * Extracts the 11-character YouTube video ID from various YouTube URL formats.
 */
export function getYoutubeId(url: string): string | null {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

/**
 * Parses start time (in seconds) from YouTube URLs (e.g. t=1m20s or t=80).
 */
export function getYoutubeStartTime(url: string): number | null {
  if (!url) return null;
  try {
    const urlObj = new URL(url);
    const t = urlObj.searchParams.get('t') || urlObj.searchParams.get('start');
    if (!t) return null;
    
    // If it's pure digits
    if (/^\d+$/.test(t)) {
      return parseInt(t, 10);
    }
    
    // If format is like 1h2m3s
    let seconds = 0;
    const hourMatch = t.match(/(\d+)h/);
    const minMatch = t.match(/(\d+)m/);
    const secMatch = t.match(/(\d+)s/);
    
    if (hourMatch) seconds += parseInt(hourMatch[1], 10) * 3600;
    if (minMatch) seconds += parseInt(minMatch[1], 10) * 60;
    if (secMatch) seconds += parseInt(secMatch[1], 10);
    
    return seconds > 0 ? seconds : null;
  } catch (e) {
    // Fallback simple regex check if full URL parsing fails
    const match = url.match(/[?&](t|start)=([^&#]+)/);
    if (match) {
      const val = match[2];
      if (/^\d+$/.test(val)) return parseInt(val, 10);
    }
    return null;
  }
}

/**
 * Checks whether a URL is a YouTube URL.
 */
export function isYoutubeUrl(url: string): boolean {
  if (!url) return false;
  return url.includes('youtube.com') || url.includes('youtu.be') || url.includes('embed/');
}

/**
 * Checks whether a URL points to a direct video file.
 */
export function isDirectVideoUrl(url: string): boolean {
  if (!url) return false;
  const cleanUrl = url.split('?')[0].toLowerCase();
  return cleanUrl.endsWith('.mp4') || 
         cleanUrl.endsWith('.m4v') || 
         cleanUrl.endsWith('.mov') || 
         cleanUrl.endsWith('.webm');
}

/**
 * Converts any standard YouTube URL or shortened youtu.be link into a valid YouTube embed URL.
 * Appends standard controls and start time parameters if available.
 */
export function getYoutubeEmbedUrl(url: string, startSeconds?: number): string | null {
  const videoId = getYoutubeId(url);
  if (!videoId) return null;
  
  let embedUrl = `https://www.youtube.com/embed/${videoId}?enablejsapi=1`;
  
  let startTime = startSeconds;
  if (startTime === undefined || startTime === 0) {
    const parsedTime = getYoutubeStartTime(url);
    if (parsedTime !== null) {
      startTime = parsedTime;
    }
  }
  
  if (startTime && startTime > 0) {
    embedUrl += `&start=${startTime}`;
  }
  
  return embedUrl;
}
