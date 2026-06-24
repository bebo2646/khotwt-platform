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
