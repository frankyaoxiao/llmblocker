/**
 * Background Service Worker for Focus Guard extension
 */
class BackgroundService {
  constructor() {
    this.llmClient = new LLMClient();
    this.pendingAnalyses = new Map();
    this.settings = {};
    
    this.initialize();
  }

  /**
   * Initialize background service
   */
  async initialize() {
    try {
      console.log('[Focus Guard] Background service initializing...');
      
      // Load initial settings
      this.settings = await StorageManager.getSettings();
      console.log('[Focus Guard] Settings loaded:', this.settings);
      
      // Set up message listeners
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        console.log('[Focus Guard] Received message:', message.type, 'from tab:', sender.tab?.id);
        this.handleMessage(message, sender, sendResponse);
        return true; // Keep message channel open for async responses
      });

      // Set up storage change listeners
      chrome.storage.onChanged.addListener((changes, areaName) => {
        this.handleStorageChange(changes, areaName);
      });

      // Clean up expired cache periodically
      setInterval(() => {
        this.llmClient.getCacheStats(); // This also cleans up expired entries
      }, 60000); // Every minute

      console.log('[Focus Guard] Background service initialized successfully');
    } catch (error) {
      console.error('[Focus Guard] Failed to initialize background service:', error);
    }
  }

  /**
   * Handle messages from content scripts and popup
   */
  async handleMessage(message, sender, sendResponse) {
    try {
      const { type, payload } = message;
      
      Utils.log('info', 'Received message', { type, tabId: sender.tab?.id });

      switch (type) {
        case CONSTANTS.MESSAGE_TYPES.ANALYZE_PAGE:
          await this.handlePageAnalysis(payload, sender, sendResponse);
          break;

        case CONSTANTS.MESSAGE_TYPES.GET_GOALS:
          await this.handleGetGoals(sendResponse);
          break;

        case CONSTANTS.MESSAGE_TYPES.BYPASS_PAGE:
          await this.handlePageBypass(payload, sender);
          sendResponse({ success: true });
          break;

        case CONSTANTS.MESSAGE_TYPES.TOGGLE_EXTENSION:
          await this.handleExtensionToggle(payload);
          sendResponse({ success: true });
          break;

        case 'VALIDATE_API_KEY':
          await this.handleApiValidation(payload, sendResponse);
          break;

        default:
          Utils.log('warn', 'Unknown message type', { type });
          sendResponse({ error: 'Unknown message type' });
      }
    } catch (error) {
      Utils.log('error', 'Failed to handle message', error);
      sendResponse({ error: error.message });
    }
  }

  /**
   * Handle page analysis request
   */
  async handlePageAnalysis(payload, sender, sendResponse) {
    const { url, title, content, timestamp } = payload;
    const tabId = sender.tab?.id;

    console.log('[Focus Guard] Handling page analysis for:', { url, title, tabId });

    if (!tabId) {
      console.error('[Focus Guard] No tab ID available');
      sendResponse({ error: 'No tab ID available' });
      return;
    }

    try {
      // Check if extension is enabled
      if (!this.settings.enabled) {
        console.log('[Focus Guard] Extension disabled, allowing page');
        sendResponse({
          type: CONSTANTS.MESSAGE_TYPES.ANALYSIS_RESULT,
          payload: {
            shouldBlock: false,
            confidence: 0,
            reasoning: 'Extension disabled'
          }
        });
        return;
      }

      console.log('[Focus Guard] Extension enabled, proceeding with analysis');

      // Prevent duplicate analyses for the same tab
      const pendingKey = `${tabId}-${url}`;
      if (this.pendingAnalyses.has(pendingKey)) {
        Utils.log('info', 'Analysis already pending for tab', { tabId, url });
        return;
      }

      this.pendingAnalyses.set(pendingKey, timestamp);

      // Get current goals and settings
      const [goals, currentSettings] = await Promise.all([
        StorageManager.getGoals(),
        StorageManager.getSettings()
      ]);

      // Update settings cache
      this.settings = currentSettings;

      // Update rate limit timestamp
      const updatedSettings = Utils.updateRateLimit(currentSettings);
      await StorageManager.setSettings(updatedSettings);

      // Perform LLM analysis
      const result = await this.llmClient.analyzePageContent(
        title,
        content,
        goals.filter(goal => goal.isActive),
        currentSettings
      );

      // Update analytics
      await StorageManager.updateAnalytics({
        totalRequests: 1,
        ...(result.shouldBlock ? { blockedPages: 1 } : {})
      });

      Utils.log('info', 'Page analysis completed', {
        url,
        confidence: result.confidence,
        shouldBlock: result.shouldBlock,
        tabId
      });

      // Send result to content script
      sendResponse({
        type: CONSTANTS.MESSAGE_TYPES.ANALYSIS_RESULT,
        payload: result
      });

    } catch (error) {
      Utils.log('error', 'Page analysis failed', error);
      
      // Fail-open: allow page on error
      sendResponse({
        type: CONSTANTS.MESSAGE_TYPES.ANALYSIS_RESULT,
        payload: {
          shouldBlock: false,
          confidence: 0,
          reasoning: `Analysis failed: ${error.message}`,
          error: error.message
        }
      });
    } finally {
      // Clean up pending analysis
      const pendingKey = `${tabId}-${url}`;
      this.pendingAnalyses.delete(pendingKey);
    }
  }

  /**
   * Handle get goals request
   */
  async handleGetGoals(sendResponse) {
    try {
      const goals = await StorageManager.getGoals();
      sendResponse({ goals });
    } catch (error) {
      Utils.log('error', 'Failed to get goals', error);
      sendResponse({ error: error.message, goals: [] });
    }
  }

  /**
   * Handle page bypass
   */
  async handlePageBypass(payload, sender) {
    const { url, confidence, timestamp } = payload;
    const tabId = sender.tab?.id;

    try {
      // Update analytics
      await StorageManager.updateAnalytics({
        bypassedPages: 1
      });

      Utils.log('info', 'Page bypassed by user', {
        url,
        confidence,
        tabId,
        timestamp
      });

      // Could implement learning from bypasses here in the future
      // For now, just log the event
      
    } catch (error) {
      Utils.log('error', 'Failed to handle page bypass', error);
    }
  }

  /**
   * Handle extension toggle
   */
  async handleExtensionToggle(payload) {
    try {
      const { enabled } = payload;
      
      await StorageManager.setSettings({ enabled });
      this.settings = await StorageManager.getSettings();

      Utils.log('info', 'Extension toggled', { enabled });
    } catch (error) {
      Utils.log('error', 'Failed to toggle extension', error);
      throw error;
    }
  }

  /**
   * Handle API key validation
   */
  async handleApiValidation(payload, sendResponse) {
    try {
      const { provider, apiKey } = payload;
      
      if (!Utils.validateApiKey(provider, apiKey)) {
        sendResponse({
          success: false,
          error: 'Invalid API key format'
        });
        return;
      }

      const result = await this.llmClient.validateCredentials(provider, apiKey);
      sendResponse(result);
    } catch (error) {
      Utils.log('error', 'API validation failed', error);
      sendResponse({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Handle storage changes
   */
  handleStorageChange(changes, areaName) {
    if (areaName !== 'sync') return;

    try {
      // Update settings cache when storage changes
      if (changes[CONSTANTS.STORAGE_KEYS.SETTINGS]) {
        const newSettings = changes[CONSTANTS.STORAGE_KEYS.SETTINGS].newValue;
        if (newSettings) {
          this.settings = { ...CONSTANTS.DEFAULT_SETTINGS, ...newSettings };
          Utils.log('info', 'Settings updated from storage change');
        }
      }

      // Clear LLM cache when goals change
      if (changes[CONSTANTS.STORAGE_KEYS.GOALS]) {
        this.llmClient.clearCache();
        Utils.log('info', 'LLM cache cleared due to goals change');
      }
    } catch (error) {
      Utils.log('error', 'Failed to handle storage change', error);
    }
  }

  /**
   * Get service statistics
   */
  getStats() {
    return {
      pendingAnalyses: this.pendingAnalyses.size,
      cacheStats: this.llmClient.getCacheStats(),
      settings: this.settings
    };
  }
}

// Initialize background service
const backgroundService = new BackgroundService();

// Handle extension lifecycle events
chrome.runtime.onInstalled.addListener(async (details) => {
  try {
    Utils.log('info', 'Extension installed/updated', { reason: details.reason });
    
    if (details.reason === 'install') {
      // Set up default settings on first install
      await StorageManager.setSettings(CONSTANTS.DEFAULT_SETTINGS);
      
      // Open options page for first-time setup
      chrome.runtime.openOptionsPage();
    }
  } catch (error) {
    Utils.log('error', 'Failed to handle installation', error);
  }
});

chrome.runtime.onStartup.addListener(() => {
  Utils.log('info', 'Extension startup');
});

// Handle tab updates for SPA navigation
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only process completed navigation with URL change
  if (changeInfo.status === 'complete' && changeInfo.url) {
    Utils.log('info', 'Tab navigation detected', { tabId, url: changeInfo.url });
  }
});

// Expose service for debugging (development only)
if (typeof globalThis !== 'undefined') {
  globalThis.focusGuardService = backgroundService;
}