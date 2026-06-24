declare global {
  interface Window {
    dataLayer: any[];
    gtag?: (...args: any[]) => void;
  }
}

/**
 * Initializes Google Analytics if the measurement ID is provided.
 */
export function initGA() {
  const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID;
  if (!measurementId) {
    console.log('[Google Analytics] VITE_GA_MEASUREMENT_ID not found. Skipping initialization.');
    return;
  }

  const scriptId = 'google-analytics-gtag';
  if (!document.getElementById(scriptId)) {
    // 1. Inject script tag
    const script = document.createElement('script');
    script.id = scriptId;
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    document.head.appendChild(script);

    // 2. Inject inline script for initialization
    const inlineScript = document.createElement('script');
    inlineScript.innerHTML = `
      window.dataLayer = window.dataLayer || [];
      window.gtag = function(){dataLayer.push(arguments);}
      window.gtag('js', new Date());
      window.gtag('config', '${measurementId}', { send_page_view: false });
    `;
    document.head.appendChild(inlineScript);
    console.log('[Google Analytics] Initialized GA successfully with measurement ID:', measurementId);
  }
}

/**
 * Tracks a page view event.
 */
export function trackPageView(pagePath: string) {
  const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID;
  if (measurementId && typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag('config', measurementId, {
      page_path: pagePath,
    });
    console.log('[Google Analytics] Tracked PageView for route:', pagePath);
  }
}
