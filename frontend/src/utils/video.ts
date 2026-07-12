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
 * Extracts YouTube video ID and returns a clean base embed URL.
 */
export function getYoutubeEmbedUrl(url: string): string {
  const match = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^?&/]+)/
  );

  if (!match) return url;

  return `https://www.youtube.com/embed/${match[1]}`;
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
