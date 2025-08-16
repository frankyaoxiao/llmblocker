/**
 * Firefox-specific background script wrapper
 * Handles Firefox's background script model vs Chrome's service worker model
 */

// Firefox compatibility: ensure chrome API is available as browser API
if (typeof browser !== 'undefined' && typeof chrome === 'undefined') {
  // Firefox uses 'browser' API, create chrome alias
  window.chrome = browser;
}

// Import the main service worker logic
// Note: In Firefox background scripts, we can import other scripts
if (typeof importScripts === 'function') {
  // If importScripts is available (Web Worker context)
  importScripts('service-worker.js');
} else {
  // If not, load the script content directly (background page context)
  // This is a fallback - normally the manifest should load both files
  console.log('[Focus Guard] Firefox background script initializing...');
}

// Firefox-specific initialization
function initializeFirefoxBackground() {
  console.log('[Focus Guard] Firefox background script ready');
  
  // Ensure the background service is initialized
  if (typeof BackgroundService === 'undefined') {
    console.error('[Focus Guard] BackgroundService not loaded in Firefox context');
    return;
  }
  
  // Firefox may need explicit initialization
  if (!window.backgroundService) {
    try {
      window.backgroundService = new BackgroundService();
      console.log('[Focus Guard] Firefox background service initialized');
    } catch (error) {
      console.error('[Focus Guard] Failed to initialize Firefox background service:', error);
    }
  }
}

// Initialize when DOM is ready (Firefox background scripts)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeFirefoxBackground);
} else {
  initializeFirefoxBackground();
}

// Also try immediate initialization
setTimeout(initializeFirefoxBackground, 100);