/**
 * Extracts YouTube video ID from various YouTube URL formats.
 */
export function extractYoutubeId(url: string): string | null {
  if (!url) return null;
  // Strictly exclude Bunny Stream or other CDNs containing /embed/
  if (url.includes('mediadelivery.net') || url.includes('bunny') || url.includes('b-cdn.net')) {
    return null;
  }
  const regExp = /(?:youtube(?:-nocookie)?\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?|shorts)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = url.match(regExp);
  return match ? match[1] : null;
}

/**
 * Checks whether a URL is a YouTube URL.
 */
export function isYoutubeUrl(url: string): boolean {
  if (!url) return false;
  if (url.includes('mediadelivery.net') || url.includes('bunny') || url.includes('b-cdn.net')) {
    return false;
  }
  return extractYoutubeId(url) !== null || 
         url.includes('youtube.com') || 
         url.includes('youtu.be') || 
         url.includes('youtube-nocookie.com');
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
 * Extracts YouTube video ID and returns a clean base embed URL.
 */
export function getYoutubeEmbedUrl(url: string): string {
  const videoId = extractYoutubeId(url);
  if (!videoId) return url;
  return `https://www.youtube-nocookie.com/embed/${videoId}`;
}

/**
 * Formats duration in seconds to a consistent, user-friendly Arabic format.
 */
export function formatDurationArabic(seconds: number): string {
  if (!seconds || seconds <= 0) return '0 ثانية';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  const parts: string[] = [];
  if (hrs > 0) {
    parts.push(`${hrs} ساعة`);
  }
  if (mins > 0) {
    parts.push(`${mins} دقيقة`);
  }
  if (secs > 0 || parts.length === 0) {
    parts.push(`${secs} ثانية`);
  }
  return parts.join(' و ');
}

/**
 * Formats watched time in seconds to a consistent, user-friendly Arabic format.
 */
export function formatWatchedTimeArabic(seconds: number): string {
  if (seconds === undefined || seconds === null || seconds <= 0) return '0 ثانية';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts: string[] = [];
  
  if (hrs > 0) {
    parts.push(`${hrs} ساعة`);
  }
  
  if (mins > 0) {
    if (mins >= 3 && mins <= 10) {
      parts.push(`${mins} دقائق`);
    } else {
      parts.push(`${mins} دقيقة`);
    }
  }
  
  if (hrs === 0 && mins === 0) {
    parts.push(`${secs} ثانية`);
  }

  return parts.join(' و ');
}

