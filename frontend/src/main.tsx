import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

// Global Date prototype safety patch to prevent "Invalid Date" or crashes on invalid date strings
const originalToLocaleDateString = Date.prototype.toLocaleDateString;
Date.prototype.toLocaleDateString = function (this: Date, locale?: any, options?: any) {
  if (isNaN(this.getTime())) return '-';
  return originalToLocaleDateString.call(this, locale, options);
};

const originalToLocaleTimeString = Date.prototype.toLocaleTimeString;
Date.prototype.toLocaleTimeString = function (this: Date, locale?: any, options?: any) {
  if (isNaN(this.getTime())) return '-';
  return originalToLocaleTimeString.call(this, locale, options);
};

const originalToISOString = Date.prototype.toISOString;
Date.prototype.toISOString = function (this: Date) {
  if (isNaN(this.getTime())) return new Date().toISOString();
  return originalToISOString.call(this);
};

import App from './App.tsx'
import ErrorBoundary from './components/ErrorBoundary.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
