import { CONSTANTS } from './constants.js';

/**
 * Storage utility functions for Chrome extension
 */
export class StorageManager {
  
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
}