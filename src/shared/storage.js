// Firefox compatibility: ensure chrome API is available
if (typeof browser !== 'undefined' && typeof chrome === 'undefined') {
  globalThis.chrome = browser;
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
   * Save goals to storage
   */
  static async setGoals(goals) {
    try {
      await chrome.storage.sync.set({
        [CONSTANTS.STORAGE_KEYS.GOALS]: goals
      });
      return true;
    } catch (error) {
      console.error('Error saving goals:', error);
      return false;
    }
  }

  /**
   * Add a new goal
   */
  static async addGoal(goalText) {
    try {
      const goals = await this.getGoals();
      
      // Validate goal
      if (!goalText || goalText.trim().length === 0) {
        throw new Error('Goal text cannot be empty');
      }
      
      if (goalText.length > CONSTANTS.UI.MAX_GOAL_LENGTH) {
        throw new Error(`Goal text cannot exceed ${CONSTANTS.UI.MAX_GOAL_LENGTH} characters`);
      }
      
      if (goals.length >= CONSTANTS.UI.MAX_GOALS_COUNT) {
        throw new Error(`Cannot exceed ${CONSTANTS.UI.MAX_GOALS_COUNT} goals`);
      }

      const newGoal = {
        id: this.generateId(),
        text: goalText.trim(),
        createdAt: Date.now(),
        isActive: true
      };

      goals.push(newGoal);
      await this.setGoals(goals);
      return newGoal;
    } catch (error) {
      console.error('Error adding goal:', error);
      throw error;
    }
  }

  /**
   * Remove a goal by ID
   */
  static async removeGoal(goalId) {
    try {
      const goals = await this.getGoals();
      const filteredGoals = goals.filter(goal => goal.id !== goalId);
      await this.setGoals(filteredGoals);
      return true;
    } catch (error) {
      console.error('Error removing goal:', error);
      return false;
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
   * Get analytics data
   */
  static async getAnalytics() {
    try {
      const result = await chrome.storage.sync.get(CONSTANTS.STORAGE_KEYS.ANALYTICS);
      return result[CONSTANTS.STORAGE_KEYS.ANALYTICS] || {
        totalRequests: 0,
        blockedPages: 0,
        bypassedPages: 0
      };
    } catch (error) {
      console.error('Error getting analytics:', error);
      return { totalRequests: 0, blockedPages: 0, bypassedPages: 0 };
    }
  }

  /**
   * Update analytics
   */
  static async updateAnalytics(updates) {
    try {
      const analytics = await this.getAnalytics();
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

  /**
   * Clear all extension data
   */
  static async clearAllData() {
    try {
      await chrome.storage.sync.remove([
        CONSTANTS.STORAGE_KEYS.GOALS,
        CONSTANTS.STORAGE_KEYS.SETTINGS,
        CONSTANTS.STORAGE_KEYS.ANALYTICS
      ]);
      return true;
    } catch (error) {
      console.error('Error clearing data:', error);
      return false;
    }
  }

  /**
   * Generate a unique ID
   */
  static generateId() {
    return 'goal_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Export all data for backup
   */
  static async exportData() {
    try {
      const [goals, settings, analytics] = await Promise.all([
        this.getGoals(),
        this.getSettings(),
        this.getAnalytics()
      ]);

      return {
        goals,
        settings: { ...settings, apiKey: '' }, // Remove API key for security
        analytics,
        exportedAt: Date.now(),
        version: '1.0.0'
      };
    } catch (error) {
      console.error('Error exporting data:', error);
      throw error;
    }
  }

  /**
   * Import data from backup (excluding API key)
   */
  static async importData(data) {
    try {
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid import data');
      }

      if (data.goals && Array.isArray(data.goals)) {
        await this.setGoals(data.goals);
      }

      if (data.settings && typeof data.settings === 'object') {
        // Don't import API key for security
        const { apiKey, ...settingsToImport } = data.settings;
        await this.setSettings(settingsToImport);
      }

      return true;
    } catch (error) {
      console.error('Error importing data:', error);
      throw error;
    }
  }

  /**
   * Get token usage for the last N days
   */
  static async getTokenUsage(days = 7) {
    try {
      const keys = [];
      const today = new Date();
      
      for (let i = 0; i < days; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        keys.push(`tokenUsage_${date.toISOString().split('T')[0]}`);
      }
      
      const result = await chrome.storage.local.get(keys);
      return result;
    } catch (error) {
      console.error('Error getting token usage:', error);
      return {};
    }
  }

  /**
   * Calculate total token usage across all providers and days
   */
  static calculateTotalTokenUsage(tokenUsageData) {
    const totals = {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      requests: 0,
      byProvider: {}
    };
    
    Object.values(tokenUsageData).forEach(dayData => {
      if (dayData && typeof dayData === 'object') {
        Object.entries(dayData).forEach(([provider, usage]) => {
          if (!totals.byProvider[provider]) {
            totals.byProvider[provider] = {
              inputTokens: 0,
              outputTokens: 0,
              totalTokens: 0,
              requests: 0
            };
          }
          
          totals.inputTokens += usage.inputTokens || 0;
          totals.outputTokens += usage.outputTokens || 0;
          totals.totalTokens += usage.totalTokens || 0;
          totals.requests += usage.requests || 0;
          
          totals.byProvider[provider].inputTokens += usage.inputTokens || 0;
          totals.byProvider[provider].outputTokens += usage.outputTokens || 0;
          totals.byProvider[provider].totalTokens += usage.totalTokens || 0;
          totals.byProvider[provider].requests += usage.requests || 0;
        });
      }
    });
    
    return totals;
  }

  /**
   * Get whitelist from storage
   */
  static async getWhitelist() {
    try {
      const result = await chrome.storage.sync.get(CONSTANTS.STORAGE_KEYS.WHITELIST);
      return result[CONSTANTS.STORAGE_KEYS.WHITELIST] || [];
    } catch (error) {
      console.error('Error getting whitelist:', error);
      return [];
    }
  }

  /**
   * Save whitelist to storage
   */
  static async setWhitelist(whitelist) {
    try {
      // Validate whitelist
      if (!Array.isArray(whitelist)) {
        throw new Error('Whitelist must be an array');
      }
      
      if (whitelist.length > CONSTANTS.UI.MAX_WHITELIST_COUNT) {
        throw new Error(`Whitelist cannot exceed ${CONSTANTS.UI.MAX_WHITELIST_COUNT} domains`);
      }
      
      // Validate each domain
      const validatedDomains = whitelist.map(domain => {
        const normalized = this.normalizeDomain(domain);
        if (!this.isValidDomain(normalized)) {
          throw new Error(`Invalid domain: ${domain}`);
        }
        return normalized;
      });
      
      // Remove duplicates
      const uniqueDomains = [...new Set(validatedDomains)];
      
      await chrome.storage.sync.set({
        [CONSTANTS.STORAGE_KEYS.WHITELIST]: uniqueDomains
      });
      return uniqueDomains;
    } catch (error) {
      console.error('Error saving whitelist:', error);
      throw error;
    }
  }

  /**
   * Add domain to whitelist
   */
  static async addToWhitelist(domain) {
    try {
      const whitelist = await this.getWhitelist();
      const normalized = this.normalizeDomain(domain);
      
      if (!this.isValidDomain(normalized)) {
        throw new Error(`Invalid domain: ${domain}`);
      }
      
      if (whitelist.includes(normalized)) {
        throw new Error('Domain already in whitelist');
      }
      
      if (whitelist.length >= CONSTANTS.UI.MAX_WHITELIST_COUNT) {
        throw new Error(`Whitelist cannot exceed ${CONSTANTS.UI.MAX_WHITELIST_COUNT} domains`);
      }
      
      whitelist.push(normalized);
      return await this.setWhitelist(whitelist);
    } catch (error) {
      console.error('Error adding to whitelist:', error);
      throw error;
    }
  }

  /**
   * Remove domain from whitelist
   */
  static async removeFromWhitelist(domain) {
    try {
      const whitelist = await this.getWhitelist();
      const normalized = this.normalizeDomain(domain);
      const updatedWhitelist = whitelist.filter(d => d !== normalized);
      return await this.setWhitelist(updatedWhitelist);
    } catch (error) {
      console.error('Error removing from whitelist:', error);
      throw error;
    }
  }

  /**
   * Check if domain is whitelisted
   */
  static async isDomainWhitelisted(url) {
    try {
      const whitelist = await this.getWhitelist();
      const domain = this.extractDomain(url);
      
      if (!domain) return false;
      
      // Check exact match first
      if (whitelist.includes(domain)) {
        return true;
      }
      
      // Check if any whitelisted domain is a parent domain
      return whitelist.some(whitelistedDomain => {
        // Allow subdomains: if whitelist has "example.com", allow "sub.example.com"
        return domain === whitelistedDomain || domain.endsWith('.' + whitelistedDomain);
      });
    } catch (error) {
      console.error('Error checking whitelist:', error);
      return false;
    }
  }

  /**
   * Normalize domain (remove protocol, www, trailing slash, etc.)
   */
  static normalizeDomain(input) {
    if (!input || typeof input !== 'string') {
      return '';
    }
    
    let domain = input.toLowerCase().trim();
    
    // Remove protocol
    domain = domain.replace(/^https?:\/\//, '');
    
    // Remove www prefix
    domain = domain.replace(/^www\./, '');
    
    // Remove path, query, and fragment
    domain = domain.split('/')[0].split('?')[0].split('#')[0];
    
    // Remove port
    domain = domain.split(':')[0];
    
    return domain;
  }

  /**
   * Extract domain from URL
   */
  static extractDomain(url) {
    try {
      if (!url) return null;
      
      // Handle relative URLs
      if (!url.includes('://')) {
        url = 'https://' + url;
      }
      
      const urlObj = new URL(url);
      return this.normalizeDomain(urlObj.hostname);
    } catch (error) {
      // Fallback to manual parsing
      return this.normalizeDomain(url);
    }
  }

  /**
   * Validate domain format
   */
  static isValidDomain(domain) {
    if (!domain || typeof domain !== 'string') {
      return false;
    }
    
    // Basic length check
    if (domain.length > CONSTANTS.WHITELIST.MAX_DOMAIN_LENGTH || domain.length < 1) {
      return false;
    }
    
    // Check for invalid characters
    if (!/^[a-zA-Z0-9.-]+$/.test(domain)) {
      return false;
    }
    
    // Must contain at least one dot
    if (!domain.includes('.')) {
      return false;
    }
    
    // Cannot start or end with dot or dash
    if (domain.startsWith('.') || domain.endsWith('.') || 
        domain.startsWith('-') || domain.endsWith('-')) {
      return false;
    }
    
    // Cannot have consecutive dots
    if (domain.includes('..')) {
      return false;
    }
    
    // Split into parts and validate each
    const parts = domain.split('.');
    if (parts.length < 2) {
      return false;
    }
    
    // Each part must be valid
    for (const part of parts) {
      if (!part || part.length > 63) {
        return false;
      }
      if (!/^[a-zA-Z0-9-]+$/.test(part)) {
        return false;
      }
      if (part.startsWith('-') || part.endsWith('-')) {
        return false;
      }
    }
    
    return true;
  }
}