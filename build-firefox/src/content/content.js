/**
 * Content Script for page analysis and blocking
 */
class ContentAnalyzer {
  constructor() {
    this.isAnalyzing = false;
    this.isBlocked = false;
    this.analysisResult = null;
    this.originalPageContent = null;
    
    this.initialize();
  }

  /**
   * Initialize the content script
   */
  async initialize() {
    try {
      console.log('[Focus Guard] Content script initializing...', { url: window.location.href });
      
      // Check if we should analyze this URL
      if (!Utils.shouldAnalyzeUrl(window.location.href)) {
        console.log('[Focus Guard] Skipping analysis for URL', { url: window.location.href });
        return;
      }
      
      console.log('[Focus Guard] URL approved for analysis');

      // Set up message listener for background script responses
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        this.handleMessage(message, sender, sendResponse);
      });

      // Wait for page to be fully loaded
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
          this.scheduleAnalysis();
        });
      } else {
        this.scheduleAnalysis();
      }
    } catch (error) {
      Utils.log('error', 'Failed to initialize content script', error);
    }
  }

  /**
   * Schedule page analysis with delay
   */
  scheduleAnalysis() {
    // Debounce analysis to handle dynamic content loading
    setTimeout(() => {
      if (!this.isAnalyzing && !this.isBlocked) {
        this.analyzeCurrentPage();
      }
    }, CONSTANTS.CONTENT.ANALYSIS_DELAY);
  }

  /**
   * Extract and analyze current page content
   */
  async analyzeCurrentPage() {
    if (this.isAnalyzing) {
      console.log('[Focus Guard] Analysis already in progress');
      return;
    }

    try {
      this.isAnalyzing = true;
      console.log('[Focus Guard] Starting page analysis...');
      
      // Extract page content
      const title = Utils.getPageTitle();
      const content = Utils.extractPageContent();
      const url = Utils.getCurrentUrl();

      console.log('[Focus Guard] Content extracted', { 
        title, 
        url, 
        contentLength: content.length,
        contentPreview: content.substring(0, 100) + '...'
      });

      // Validate extracted content
      if (!content || content.trim().length < 50) {
        console.log('[Focus Guard] Insufficient content for analysis', { url, contentLength: content.length });
        return;
      }

      console.log('[Focus Guard] Sending analysis request to background script');

      // Send analysis request to background script
      const message = {
        type: CONSTANTS.MESSAGE_TYPES.ANALYZE_PAGE,
        payload: {
          url,
          title,
          content,
          timestamp: Date.now()
        }
      };

      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          console.error('[Focus Guard] Error sending message to background:', chrome.runtime.lastError);
        } else {
          console.log('[Focus Guard] Message sent successfully, response:', response);
          // Handle the response directly since it contains the analysis result
          if (response && response.type === CONSTANTS.MESSAGE_TYPES.ANALYSIS_RESULT) {
            this.handleAnalysisResult(response.payload);
          }
        }
      });

    } catch (error) {
      console.error('[Focus Guard] Failed to analyze page:', error);
    } finally {
      this.isAnalyzing = false;
    }
  }

  /**
   * Handle messages from background script
   */
  handleMessage(message, sender, sendResponse) {
    try {
      switch (message.type) {
        case CONSTANTS.MESSAGE_TYPES.ANALYSIS_RESULT:
          this.handleAnalysisResult(message.payload);
          break;
        
        case CONSTANTS.MESSAGE_TYPES.BYPASS_PAGE:
          this.handleBypass();
          break;
        
        default:
          Utils.log('warn', 'Unknown message type', { type: message.type });
      }
    } catch (error) {
      Utils.log('error', 'Failed to handle message', error);
    }
  }

  /**
   * Handle analysis result from background script
   */
  handleAnalysisResult(result) {
    this.analysisResult = result;
    
    Utils.log('info', 'Received analysis result', result);

    if (result.shouldBlock) {
      this.blockPage(result);
    } else {
      // Ensure page is not blocked
      this.unblockPage();
    }
  }

  /**
   * Block the current page
   */
  blockPage(result) {
    if (this.isBlocked) {
      return;
    }

    try {
      this.isBlocked = true;
      
      // Store original page content
      this.originalPageContent = document.body.innerHTML;
      
      // Create and inject blocking overlay
      this.createBlockingOverlay(result);
      
      Utils.log('info', 'Page blocked', { 
        confidence: result.confidence, 
        url: window.location.href 
      });

    } catch (error) {
      Utils.log('error', 'Failed to block page', error);
      this.isBlocked = false;
    }
  }

  /**
   * Create blocking overlay UI
   */
  createBlockingOverlay(result) {
    // Remove any existing overlay
    this.removeBlockingOverlay();

    const overlay = document.createElement('div');
    overlay.id = CONSTANTS.UI.BLOCKING_OVERLAY_ID;
    overlay.className = 'focus-guard-overlay';
    
    overlay.innerHTML = `
      <div class="focus-guard-content">
        <div class="focus-guard-header">
          <div class="focus-guard-icon"></div>
          <h1 class="focus-guard-title">Page blocked</h1>
        </div>
        
        <div class="focus-guard-body">
          <p class="focus-guard-message">
            This page appears to distract from your current goals.
          </p>
          
          <div class="focus-guard-details">
            <div class="focus-guard-confidence">
              <strong>Confidence:</strong> ${result.confidence}% likely distraction
            </div>
            
            <div class="focus-guard-goals">
              <strong>Your current goals:</strong>
              <div class="focus-guard-goals-list" id="focus-guard-goals-list">
                Loading goals...
              </div>
            </div>
          </div>
        </div>
        
        <div class="focus-guard-actions">
          <button class="focus-guard-btn focus-guard-btn-bypass" id="focus-guard-bypass">
            Continue anyway
          </button>
          <button class="focus-guard-btn focus-guard-btn-secondary" id="focus-guard-back">
            Go back
          </button>
        </div>
        
        <div class="focus-guard-footer">
          <small>Focus Guard</small>
        </div>
      </div>
    `;

    // Insert overlay into page
    console.log('[Focus Guard] Clearing document body');
    document.body.innerHTML = '';
    console.log('[Focus Guard] Appending overlay to body');
    document.body.appendChild(overlay);

    // Add event listeners
    console.log('[Focus Guard] Adding event listeners');
    document.getElementById('focus-guard-bypass').addEventListener('click', () => {
      this.handleBypass();
    });

    document.getElementById('focus-guard-back').addEventListener('click', () => {
      window.history.back();
    });

    // Load and display current goals
    console.log('[Focus Guard] Loading goals for overlay');
    this.loadGoalsForOverlay();
    
    console.log('[Focus Guard] Blocking overlay created and displayed');
  }

  /**
   * Load goals for overlay display
   */
  async loadGoalsForOverlay() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: CONSTANTS.MESSAGE_TYPES.GET_GOALS
      });

      const goalsList = document.getElementById('focus-guard-goals-list');
      if (!goalsList) return;

      if (response.goals && response.goals.length > 0) {
        goalsList.innerHTML = response.goals
          .filter(goal => goal.isActive)
          .map(goal => `<div class="focus-guard-goal-item">• ${this.escapeHtml(goal.text)}</div>`)
          .join('');
      } else {
        goalsList.innerHTML = '<div class="focus-guard-no-goals">No goals set</div>';
      }
    } catch (error) {
      Utils.log('error', 'Failed to load goals for overlay', error);
      const goalsList = document.getElementById('focus-guard-goals-list');
      if (goalsList) {
        goalsList.innerHTML = '<div class="focus-guard-error">Failed to load goals</div>';
      }
    }
  }

  /**
   * Handle bypass button click
   */
  handleBypass() {
    try {
      Utils.log('info', 'User bypassed page block', { url: window.location.href });
      
      // Notify background script of bypass
      chrome.runtime.sendMessage({
        type: CONSTANTS.MESSAGE_TYPES.BYPASS_PAGE,
        payload: {
          url: window.location.href,
          confidence: this.analysisResult?.confidence,
          timestamp: Date.now()
        }
      });

      // Unblock page
      this.unblockPage();
      
    } catch (error) {
      Utils.log('error', 'Failed to handle bypass', error);
    }
  }

  /**
   * Unblock the current page
   */
  unblockPage() {
    if (!this.isBlocked) {
      return;
    }

    try {
      // Remove blocking overlay
      this.removeBlockingOverlay();
      
      // Restore original page content
      if (this.originalPageContent) {
        document.body.innerHTML = this.originalPageContent;
        this.originalPageContent = null;
      }
      
      this.isBlocked = false;
      
      Utils.log('info', 'Page unblocked', { url: window.location.href });
      
    } catch (error) {
      Utils.log('error', 'Failed to unblock page', error);
    }
  }

  /**
   * Remove blocking overlay
   */
  removeBlockingOverlay() {
    const existingOverlay = document.getElementById(CONSTANTS.UI.BLOCKING_OVERLAY_ID);
    if (existingOverlay) {
      existingOverlay.remove();
    }
  }

  /**
   * Escape HTML for security
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize content script
let contentAnalyzer;

// Handle page navigation and dynamic content changes
const initializeAnalyzer = Utils.debounce(() => {
  if (!contentAnalyzer) {
    contentAnalyzer = new ContentAnalyzer();
  } else {
    // Re-analyze page if content has changed significantly
    contentAnalyzer.scheduleAnalysis();
  }
}, 500);

// Initialize on page load
initializeAnalyzer();

// Re-initialize on navigation (for SPAs)
let lastUrl = window.location.href;
const observer = new MutationObserver(() => {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href;
    Utils.log('info', 'URL changed, re-initializing analyzer', { newUrl: lastUrl });
    initializeAnalyzer();
  }
});

// Start observing URL changes
observer.observe(document.body, { 
  childList: true, 
  subtree: true 
});

// Clean up on page unload
window.addEventListener('beforeunload', () => {
  if (observer) {
    observer.disconnect();
  }
});