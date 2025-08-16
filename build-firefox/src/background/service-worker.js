// Application constants
const CONSTANTS = {
  // Storage keys
  STORAGE_KEYS: {
    GOALS: 'focus_guard_goals',
    SETTINGS: 'focus_guard_settings',
    ANALYTICS: 'focus_guard_analytics'
  },

  // Message types for cross-component communication
  MESSAGE_TYPES: {
    ANALYZE_PAGE: 'ANALYZE_PAGE',
    ANALYSIS_RESULT: 'ANALYSIS_RESULT',
    ADD_GOAL: 'ADD_GOAL',
    REMOVE_GOAL: 'REMOVE_GOAL',
    GET_GOALS: 'GET_GOALS',
    UPDATE_SETTINGS: 'UPDATE_SETTINGS',
    GET_SETTINGS: 'GET_SETTINGS',
    TOGGLE_EXTENSION: 'TOGGLE_EXTENSION',
    BYPASS_PAGE: 'BYPASS_PAGE'
  },

  // Default settings
  DEFAULT_SETTINGS: {
    enabled: true,
    confidenceThreshold: 75,
    provider: 'openai',
    model: 'gpt-5-mini',
    apiKey: '',
    rateLimit: {
      requestsPerMinute: 20,
      lastRequestTime: 0
    }
  },

  // LLM Providers configuration
  PROVIDERS: {
    openrouter: {
      name: 'OpenRouter',
      baseUrl: 'https://openrouter.ai/api/v1',
      models: [
        'openai/gpt-5',
        'openai/gpt-5-mini', 
        'openai/gpt-5-nano',
        'anthropic/claude-opus-4.1',
        'anthropic/claude-sonnet-4',
        'google/gemini-2.5-pro',
        'google/gemini-2.0-flash-thinking-exp',
        'meta-llama/llama-3.3-70b-instruct',
        'meta-llama/llama-4-maverick',
        'qwen/qwen2.5-vl-3b-instruct',
        'qwen/qwq-32b',
        'deepseek/deepseek-r1',
        'deepseek/deepseek-chat-v3',
        'nvidia/llama-3.1-nemotron-ultra-253b-v1',
        'google/gemma-3-27b-it'
      ],
      keyRequired: true
    },
    openai: {
      name: 'OpenAI',
      baseUrl: 'https://api.openai.com/v1',
      models: [
        'gpt-5',
        'gpt-5-mini',
        'gpt-5-nano'
      ],
      keyRequired: true
    },
    anthropic: {
      name: 'Anthropic',
      baseUrl: 'https://api.anthropic.com',
      models: [
        'claude-opus-4.1',
        'claude-sonnet-4'
      ],
      keyRequired: true
    }
  },

  // Content extraction settings
  CONTENT: {
    MAX_CONTENT_LENGTH: 4000,
    UNWANTED_SELECTORS: ['script', 'style', 'nav', 'header', 'footer', 'aside', 'noscript'],
    CONTENT_SELECTORS: ['main', 'article', '[role="main"]', '.content', 'body'],
    ANALYSIS_DELAY: 500 // ms to wait after page load
  },

  // UI settings
  UI: {
    BLOCKING_OVERLAY_ID: 'focus-guard-overlay',
    MAX_GOAL_LENGTH: 200,
    MAX_GOALS_COUNT: 10
  },

  // API settings
  API: {
    TIMEOUT: 10000, // 10 seconds
    RETRY_ATTEMPTS: 2,
    CACHE_DURATION: 3600000 // 1 hour in milliseconds
  }
};

// Prompt template for LLM analysis
const ANALYSIS_PROMPT = `TASK: Analyze how likely this webpage is to DISTRACT from the user's current goals.

USER GOALS:
{goals}

WEBPAGE INFO:
Title: {title}
Content: {content}

INSTRUCTIONS:
Think step by step to evaluate this webpage:

1. GOAL ANALYSIS: What is the user trying to accomplish based on their goals?
2. CONTENT ANALYSIS: What is this webpage primarily about?
3. ALIGNMENT ASSESSMENT: How well does this webpage content relate to the user's goals?
4. DISTRACTION POTENTIAL: Could this webpage lead the user away from their goals?

Rate from 0-100 how LIKELY this webpage is to DISTRACT from the user's goals:
- 0-20: Directly supports goal achievement (educational, work-related content aligned with goals)
- 21-40: Likely helpful for achieving goals or neutral
- 41-60: Unclear relationship to goals, minor distraction potential
- 61-80: Likely distracts or provides no value toward goals  
- 81-100: Actively distracts from goals (social media, entertainment unrelated to goals)

Think through your reasoning, then respond with only the final number (0-100).`;

/**
 * Utility functions for the extension
 */
class Utils {
  
  /**
   * Create prompt for LLM analysis
   */
  static createAnalysisPrompt(title, content, goals) {
    const goalsText = this.formatGoalsForPrompt(goals);
    
    return ANALYSIS_PROMPT
      .replace('{goals}', goalsText)
      .replace('{title}', title)
      .replace('{content}', content);
  }

  /**
   * Format goals for LLM prompt
   */
  static formatGoalsForPrompt(goals) {
    if (!goals || !Array.isArray(goals) || goals.length === 0) {
      return 'No specific goals set';
    }

    return goals
      .filter(goal => goal.isActive)
      .map(goal => `- ${goal.text}`)
      .join('\n');
  }

  /**
   * Parse confidence score from LLM response
   */
  static parseConfidenceScore(response) {
    if (!response || typeof response !== 'string') {
      return null;
    }

    // Extract number from response
    const match = response.trim().match(/\d+/);
    if (!match) {
      return null;
    }

    const score = parseInt(match[0], 10);
    
    // Validate score is in valid range
    if (score < 0 || score > 100) {
      return null;
    }

    return score;
  }

  /**
   * Check if rate limit is exceeded
   */
  static isRateLimited(settings) {
    const now = Date.now();
    const timeSinceLastRequest = now - (settings.rateLimit.lastRequestTime || 0);
    const minInterval = (60 * 1000) / settings.rateLimit.requestsPerMinute; // ms between requests
    
    return timeSinceLastRequest < minInterval;
  }

  /**
   * Update rate limit timestamp
   */
  static updateRateLimit(settings) {
    return {
      ...settings,
      rateLimit: {
        ...settings.rateLimit,
        lastRequestTime: Date.now()
      }
    };
  }

  /**
   * Generate cache key for page analysis
   */
  static generateCacheKey(url, content, goals) {
    const goalsHash = goals.map(g => g.text).join('|');
    const contentHash = content.substring(0, 100); // First 100 chars
    return btoa(`${url}:${contentHash}:${goalsHash}`).substring(0, 50);
  }
}

/**
 * Storage utility functions for Chrome extension
 */
class StorageManager {
  
  /**
   * Get goals from storage
   */
  static async getGoals() {
    try {
      const result = await chrome.storage.sync.get(CONSTANTS.STORAGE_KEYS.GOALS);
      return result[CONSTANTS.STORAGE_KEYS.GOALS] || [];
    } catch (error) {
      console.error('Error getting goals:', error);
      return [];
    }
  }

  /**
   * Get settings from storage
   */
  static async getSettings() {
    try {
      const result = await chrome.storage.sync.get(CONSTANTS.STORAGE_KEYS.SETTINGS);
      return {
        ...CONSTANTS.DEFAULT_SETTINGS,
        ...result[CONSTANTS.STORAGE_KEYS.SETTINGS]
      };
    } catch (error) {
      console.error('Error getting settings:', error);
      return CONSTANTS.DEFAULT_SETTINGS;
    }
  }

  /**
   * Save settings to storage
   */
  static async setSettings(settings) {
    try {
      const currentSettings = await this.getSettings();
      const updatedSettings = { ...currentSettings, ...settings };
      
      await chrome.storage.sync.set({
        [CONSTANTS.STORAGE_KEYS.SETTINGS]: updatedSettings
      });
      return updatedSettings;
    } catch (error) {
      console.error('Error saving settings:', error);
      throw error;
    }
  }

  /**
   * Update analytics
   */
  static async updateAnalytics(updates) {
    try {
      const result = await chrome.storage.sync.get(CONSTANTS.STORAGE_KEYS.ANALYTICS);
      const analytics = result[CONSTANTS.STORAGE_KEYS.ANALYTICS] || {
        totalRequests: 0,
        blockedPages: 0,
        bypassedPages: 0
      };
      
      const updatedAnalytics = { ...analytics };
      
      Object.keys(updates).forEach(key => {
        if (typeof updates[key] === 'number') {
          updatedAnalytics[key] = (updatedAnalytics[key] || 0) + updates[key];
        }
      });

      await chrome.storage.sync.set({
        [CONSTANTS.STORAGE_KEYS.ANALYTICS]: updatedAnalytics
      });
      return updatedAnalytics;
    } catch (error) {
      console.error('Error updating analytics:', error);
      throw error;
    }
  }
}

/**
 * Abstract base class for LLM providers
 */
class LLMProvider {
  constructor(apiKey, model) {
    this.apiKey = apiKey;
    this.model = model;
  }

  async makeRequest(prompt) {
    throw new Error('makeRequest must be implemented by subclass');
  }

  getHeaders() {
    return {
      'Content-Type': 'application/json'
    };
  }

  async handleResponse(response) {
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    return response.json();
  }
}

/**
 * OpenRouter API provider
 */
class OpenRouterProvider extends LLMProvider {
  constructor(apiKey, model = 'openai/gpt-5-mini') {
    super(apiKey, model);
    this.baseUrl = CONSTANTS.PROVIDERS.openrouter.baseUrl;
  }

  getHeaders() {
    return {
      ...super.getHeaders(),
      'Authorization': `Bearer ${this.apiKey}`,
      'HTTP-Referer': 'https://focus-guard-extension.com',
      'X-Title': 'Focus Guard Extension'
    };
  }

  async makeRequest(prompt) {
    const requestBody = {
      model: this.model,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 20,
      temperature: 0.1,
      stream: false
    };

    // Add GPT-5 specific parameters if using GPT-5 models
    if (this.model.includes('gpt-5')) {
      requestBody.reasoning_effort = 'minimal'; // Fast analysis for web filtering
      requestBody.verbosity = 'low'; // Concise responses
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(requestBody)
    });

    const data = await this.handleResponse(response);
    return data.choices[0]?.message?.content || '';
  }
}

/**
 * OpenAI API provider
 */
class OpenAIProvider extends LLMProvider {
  constructor(apiKey, model = 'gpt-5-mini') {
    super(apiKey, model);
    this.baseUrl = CONSTANTS.PROVIDERS.openai.baseUrl;
  }

  getHeaders() {
    return {
      ...super.getHeaders(),
      'Authorization': `Bearer ${this.apiKey}`
    };
  }

  async makeRequest(prompt) {
    const requestBody = {
      model: this.model,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      stream: false
    };

    // GPT-5 specific parameters (no temperature, uses max_completion_tokens)
    if (this.model.includes('gpt-5')) {
      requestBody.max_completion_tokens = 20; // GPT-5 uses max_completion_tokens
      requestBody.reasoning_effort = 'minimal'; // Fast analysis for web filtering
      requestBody.verbosity = 'low'; // Concise responses
      // Note: GPT-5 only supports temperature=1.0 (default), so we omit it
    } else {
      // For any remaining older models (shouldn't be used but just in case)
      requestBody.max_tokens = 20;
      requestBody.temperature = 0.1;
    }

    console.log('[Focus Guard] OpenAI API request body:', JSON.stringify(requestBody, null, 2));
    console.log('[Focus Guard] Model being sent:', this.model);

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(requestBody)
    });

    const data = await this.handleResponse(response);
    return data.choices[0]?.message?.content || '';
  }
}

/**
 * Anthropic API provider
 */
class AnthropicProvider extends LLMProvider {
  constructor(apiKey, model = 'claude-sonnet-4') {
    super(apiKey, model);
    this.baseUrl = CONSTANTS.PROVIDERS.anthropic.baseUrl;
  }

  getHeaders() {
    return {
      ...super.getHeaders(),
      'x-api-key': this.apiKey,
      'anthropic-version': '2025-01-01' // Updated for Claude 4 support
    };
  }

  async makeRequest(prompt) {
    const response = await fetch(`${this.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        model: this.model,
        max_tokens: 20,
        temperature: 0.1,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    });

    const data = await this.handleResponse(response);
    return data.content[0]?.text || '';
  }
}

/**
 * Main LLM Client class
 */
class LLMClient {
  constructor() {
    this.cache = new Map();
  }

  /**
   * Create provider instance based on settings
   */
  createProvider(provider, apiKey, model) {
    switch (provider) {
      case 'openrouter':
        return new OpenRouterProvider(apiKey, model);
      case 'openai':
        return new OpenAIProvider(apiKey, model);
      case 'anthropic':
        return new AnthropicProvider(apiKey, model);
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  /**
   * Analyze page content using LLM
   */
  async analyzePageContent(title, content, goals, settings) {
    try {
      // Validate inputs
      if (!settings.provider || !settings.apiKey) {
        throw new Error('LLM provider not configured');
      }

      if (!goals || goals.length === 0) {
        console.log('[Focus Guard] No goals set, allowing page');
        return {
          confidence: 0,
          shouldBlock: false,
          reasoning: 'No goals configured'
        };
      }

      // Check rate limiting
      if (Utils.isRateLimited(settings)) {
        console.log('[Focus Guard] Rate limit exceeded, allowing page');
        return {
          confidence: 0,
          shouldBlock: false,
          reasoning: 'Rate limit exceeded'
        };
      }

      // Create prompt
      const prompt = Utils.createAnalysisPrompt(title, content, goals);
      
      // Ensure we have a valid model
      let modelToUse = settings.model;
      if (!modelToUse || modelToUse.trim() === '') {
        if (settings.provider === 'openai') {
          modelToUse = 'gpt-5-mini';
        } else if (settings.provider === 'openrouter') {
          modelToUse = 'openai/gpt-5-mini';
        } else if (settings.provider === 'anthropic') {
          modelToUse = 'claude-sonnet-4';
        } else {
          modelToUse = 'gpt-5-mini';
        }
        console.log('[Focus Guard] No model set, using fallback:', modelToUse);
      }

      console.log('[Focus Guard] Sending LLM analysis request', {
        provider: settings.provider,
        model: modelToUse,
        originalModel: settings.model,
        promptLength: prompt.length,
        fullSettings: settings
      });

      // Create provider and make request
      const provider = this.createProvider(settings.provider, settings.apiKey, modelToUse);
      
      const startTime = Date.now();
      const response = await Promise.race([
        provider.makeRequest(prompt),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), CONSTANTS.API.TIMEOUT)
        )
      ]);
      const duration = Date.now() - startTime;

      console.log('[Focus Guard] LLM response received', { duration, response });

      // Parse confidence score
      const confidence = Utils.parseConfidenceScore(response);
      if (confidence === null) {
        throw new Error('Invalid confidence score in response');
      }

      const result = {
        confidence,
        shouldBlock: confidence >= settings.confidenceThreshold,
        reasoning: `AI confidence: ${confidence}%`,
        provider: settings.provider,
        model: settings.model,
        duration
      };

      return result;

    } catch (error) {
      console.error('[Focus Guard] LLM analysis failed:', error);
      
      // Fail-open: allow page when analysis fails
      return {
        confidence: 0,
        shouldBlock: false,
        reasoning: `Analysis failed: ${error.message}`,
        error: error.message
      };
    }
  }
}

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
        try {
          console.log('[Focus Guard] Received message:', message.type, 'from tab:', sender.tab?.id);
          this.handleMessage(message, sender, sendResponse).catch(error => {
            console.error('[Focus Guard] Error in handleMessage:', error);
            sendResponse({ error: error.message });
          });
          return true; // Keep message channel open for async responses
        } catch (error) {
          console.error('[Focus Guard] Error in message listener:', error);
          sendResponse({ error: error.message });
          return false;
        }
      });

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

        case CONSTANTS.MESSAGE_TYPES.UPDATE_SETTINGS:
          await this.handleUpdateSettings(payload, sendResponse);
          break;

        case CONSTANTS.MESSAGE_TYPES.GET_SETTINGS:
          await this.handleGetSettings(sendResponse);
          break;

        default:
          console.log('[Focus Guard] Unknown message type:', type);
          sendResponse({ error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('[Focus Guard] Failed to handle message:', error);
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

      console.log('[Focus Guard] Page analysis completed', {
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
      console.error('[Focus Guard] Page analysis failed:', error);
      
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
      console.error('[Focus Guard] Failed to get goals:', error);
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

      console.log('[Focus Guard] Page bypassed by user', {
        url,
        confidence,
        tabId,
        timestamp
      });
      
    } catch (error) {
      console.error('[Focus Guard] Failed to handle page bypass:', error);
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

      console.log('[Focus Guard] Extension toggled', { enabled });
    } catch (error) {
      console.error('[Focus Guard] Failed to toggle extension:', error);
      throw error;
    }
  }

  /**
   * Handle API key validation
   */
  async handleApiValidation(payload, sendResponse) {
    try {
      const { provider, apiKey } = payload;
      
      if (!provider || !apiKey) {
        sendResponse({
          success: false,
          error: 'Provider and API key required'
        });
        return;
      }

      // Basic validation - just check if key looks valid
      let isValid = false;
      if (provider === 'openrouter' && apiKey.startsWith('sk-or-')) {
        isValid = true;
      } else if (provider === 'openai' && apiKey.startsWith('sk-')) {
        isValid = true;
      } else if (provider === 'anthropic' && apiKey.startsWith('sk-ant-')) {
        isValid = true;
      }

      sendResponse({
        success: isValid,
        error: isValid ? null : 'Invalid API key format'
      });
    } catch (error) {
      console.error('[Focus Guard] API validation failed:', error);
      sendResponse({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Handle update settings
   */
  async handleUpdateSettings(payload, sendResponse) {
    try {
      const updatedSettings = await StorageManager.setSettings(payload);
      this.settings = updatedSettings;
      sendResponse({ success: true, settings: updatedSettings });
    } catch (error) {
      console.error('[Focus Guard] Failed to update settings:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  /**
   * Handle get settings
   */
  async handleGetSettings(sendResponse) {
    try {
      const settings = await StorageManager.getSettings();
      sendResponse({ success: true, settings });
    } catch (error) {
      console.error('[Focus Guard] Failed to get settings:', error);
      sendResponse({ success: false, error: error.message });
    }
  }
}

// Initialize background service
let backgroundService;
try {
  console.log('[Focus Guard] Initializing background service...');
  backgroundService = new BackgroundService();
  console.log('[Focus Guard] Background service created successfully');
} catch (error) {
  console.error('[Focus Guard] Failed to create background service:', error);
}

// Handle extension lifecycle events
chrome.runtime.onInstalled.addListener(async (details) => {
  try {
    console.log('[Focus Guard] Extension installed/updated', { reason: details.reason });
    
    if (details.reason === 'install') {
      // Set up default settings on first install
      await StorageManager.setSettings(CONSTANTS.DEFAULT_SETTINGS);
      
      // Open options page for first-time setup
      chrome.runtime.openOptionsPage();
    }
  } catch (error) {
    console.error('[Focus Guard] Failed to handle installation:', error);
  }
});

chrome.runtime.onStartup.addListener(() => {
  console.log('[Focus Guard] Extension startup');
});