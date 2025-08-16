import { CONSTANTS } from '../shared/constants.js';
import { Utils } from '../shared/utils.js';

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
      // Check if we should analyze this URL
      if (!Utils.shouldAnalyzeUrl(window.location.href)) {
        Utils.log('info', 'Skipping analysis for URL', { url: window.location.href });
        return;
      }

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
      return;
    }

    try {
      this.isAnalyzing = true;
      
      // Extract page content
      const title = Utils.getPageTitle();
      const content = Utils.extractPageContent();
      const url = Utils.getCurrentUrl();

      // Validate extracted content
      if (!content || content.trim().length < 50) {
        Utils.log('info', 'Insufficient content for analysis', { url, contentLength: content.length });
        return;
      }

      Utils.log('info', 'Analyzing page content', { 
        url, 
        title, 
        contentLength: content.length 
      });

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

      chrome.runtime.sendMessage(message);

    } catch (error) {
      Utils.log('error', 'Failed to analyze page', error);
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
          <div class="focus-guard-icon">🚫</div>
          <h1 class="focus-guard-title">Page Blocked by Focus Guard</h1>
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
            I think this is a mistake - bypass
          </button>
          <button class="focus-guard-btn focus-guard-btn-secondary" id="focus-guard-back">
            ← Go back
          </button>
        </div>
        
        <div class="focus-guard-footer">
          <small>Focus Guard • AI-powered distraction blocking</small>
        </div>
      </div>
    `;

    // Insert overlay into page
    document.body.innerHTML = '';
    document.body.appendChild(overlay);

    // Add event listeners
    document.getElementById('focus-guard-bypass').addEventListener('click', () => {
      this.handleBypass();
    });

    document.getElementById('focus-guard-back').addEventListener('click', () => {
      window.history.back();
    });

    // Load and display current goals
    this.loadGoalsForOverlay();
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