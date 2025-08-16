/**
 * Utility functions for the extension
 */
class Utils {
  
  /**
   * Clean and truncate text content for LLM analysis
   */
  static cleanTextContent(text) {
    if (!text || typeof text !== 'string') {
      return '';
    }

    // Remove extra whitespace and normalize
    let cleaned = text
      .replace(/\s+/g, ' ')  // Replace multiple whitespace with single space
      .replace(/\n+/g, ' ')  // Replace newlines with spaces
      .trim();

    // Truncate to max length
    if (cleaned.length > CONSTANTS.CONTENT.MAX_CONTENT_LENGTH) {
      cleaned = cleaned.substring(0, CONSTANTS.CONTENT.MAX_CONTENT_LENGTH);
      
      // Try to end at a word boundary
      const lastSpaceIndex = cleaned.lastIndexOf(' ');
      if (lastSpaceIndex > CONSTANTS.CONTENT.MAX_CONTENT_LENGTH * 0.8) {
        cleaned = cleaned.substring(0, lastSpaceIndex);
      }
      
      cleaned += '...';
    }

    return cleaned;
  }

  /**
   * Extract meaningful text content from page
   */
  static extractPageContent() {
    try {
      // Create a clone of the document body to avoid modifying the live page
      const bodyClone = document.body.cloneNode(true);
      
      // Remove unwanted elements from the clone
      CONSTANTS.CONTENT.UNWANTED_SELECTORS.forEach(selector => {
        const elements = bodyClone.querySelectorAll(selector);
        elements.forEach(el => el.remove());
      });

      // Try to find main content areas first in the clone
      let content = '';
      for (const selector of CONSTANTS.CONTENT.CONTENT_SELECTORS) {
        const element = bodyClone.querySelector(selector);
        if (element) {
          content = element.innerText || element.textContent || '';
          if (content.trim().length > 100) {
            break;
          }
        }
      }

      // Fallback to cloned body if no main content found
      if (!content || content.trim().length < 100) {
        content = bodyClone.innerText || bodyClone.textContent || '';
      }

      return this.cleanTextContent(content);
    } catch (error) {
      console.error('Error extracting page content:', error);
      return '';
    }
  }

  /**
   * Get page title
   */
  static getPageTitle() {
    return document.title || document.querySelector('h1')?.textContent || 'Untitled';
  }

  /**
   * Get current page URL
   */
  static getCurrentUrl() {
    return window.location.href;
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
   * Validate API key format
   */
  static validateApiKey(provider, apiKey) {
    if (!apiKey || typeof apiKey !== 'string') {
      return false;
    }

    const key = apiKey.trim();
    
    switch (provider) {
      case 'openai':
        return key.startsWith('sk-') && key.length > 20;
      case 'anthropic':
        return key.startsWith('sk-ant-') && key.length > 20;
      case 'openrouter':
        return key.startsWith('sk-or-') && key.length > 20;
      default:
        return key.length > 10; // Generic validation
    }
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
   * Create prompt for LLM analysis
   */
  static createAnalysisPrompt(title, content, goals) {
    const goalsText = this.formatGoalsForPrompt(goals);
    
    return CONSTANTS.ANALYSIS_PROMPT
      .replace('{goals}', goalsText)
      .replace('{title}', title)
      .replace('{content}', content);
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
   * Check if URL should be analyzed
   */
  static shouldAnalyzeUrl(url) {
    if (!url || typeof url !== 'string') {
      return false;
    }

    // Skip extension pages, chrome pages, etc.
    const skipPatterns = [
      'chrome://',
      'chrome-extension://',
      'moz-extension://',
      'about:',
      'data:',
      'javascript:'
    ];

    return !skipPatterns.some(pattern => url.startsWith(pattern));
  }

  /**
   * Debounce function
   */
  static debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  /**
   * Sleep utility
   */
  static sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Safely parse JSON
   */
  static safeJsonParse(str, defaultValue = null) {
    try {
      return JSON.parse(str);
    } catch (error) {
      console.warn('Failed to parse JSON:', error);
      return defaultValue;
    }
  }

  /**
   * Format timestamp for display
   */
  static formatTimestamp(timestamp) {
    return new Date(timestamp).toLocaleString();
  }

  /**
   * Encrypt sensitive data (basic implementation)
   */
  static encrypt(text) {
    // Simple base64 encoding - in production, use proper encryption
    return btoa(text);
  }

  /**
   * Decrypt sensitive data (basic implementation)
   */
  static decrypt(encryptedText) {
    try {
      return atob(encryptedText);
    } catch (error) {
      console.error('Decryption failed:', error);
      return '';
    }
  }

  /**
   * Log with timestamp
   */
  static log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [Focus Guard] [${level.toUpperCase()}] ${message}`;
    
    if (data) {
      console[level](logMessage, data);
    } else {
      console[level](logMessage);
    }
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