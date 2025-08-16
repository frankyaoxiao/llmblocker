// Firefox compatibility: ensure chrome API is available
if (typeof browser !== 'undefined' && typeof chrome === 'undefined') {
  globalThis.chrome = browser;
}

/**
 * Options Page Controller
 */
class OptionsController {
  constructor() {
    this.settings = {};
    this.analytics = {};
    this.goals = [];
    this.saveTimeout = null;
    
    this.initializeEventListeners();
    this.loadData();
  }

  /**
   * Initialize all event listeners
   */
  initializeEventListeners() {
    // Provider selection
    document.getElementById('provider-select').addEventListener('change', (e) => {
      this.handleProviderChange(e.target.value);
    });

    // Model selection
    document.getElementById('model-select').addEventListener('change', (e) => {
      this.handleModelChange(e.target.value);
    });

    // API key input
    const apiKeyInput = document.getElementById('api-key');
    apiKeyInput.addEventListener('input', () => this.handleApiKeyChange());
    apiKeyInput.addEventListener('blur', () => this.validateApiKey());

    // API key visibility toggle
    document.getElementById('toggle-key-visibility').addEventListener('click', () => {
      this.toggleKeyVisibility();
    });

    // Confidence threshold
    const thresholdSlider = document.getElementById('confidence-threshold');
    thresholdSlider.addEventListener('input', (e) => {
      this.handleThresholdChange(parseInt(e.target.value));
    });

    // Extension enable/disable
    document.getElementById('enable-extension').addEventListener('change', (e) => {
      this.handleExtensionToggle(e.target.checked);
    });

    // Rate limit
    document.getElementById('rate-limit').addEventListener('input', (e) => {
      this.handleRateLimitChange(parseInt(e.target.value));
    });

    // Cache enable/disable
    document.getElementById('enable-cache').addEventListener('change', (e) => {
      this.handleCacheToggle(e.target.checked);
    });

    // Statistics reset
    document.getElementById('reset-stats').addEventListener('click', () => {
      this.resetStatistics();
    });

    // Data management
    document.getElementById('export-data').addEventListener('click', () => {
      this.exportData();
    });
    
    document.getElementById('import-data').addEventListener('click', () => {
      document.getElementById('import-file').click();
    });
    
    document.getElementById('import-file').addEventListener('change', (e) => {
      this.importData(e.target.files[0]);
    });
    
    document.getElementById('reset-all').addEventListener('click', () => {
      this.resetAllData();
    });
  }

  /**
   * Load initial data
   */
  async loadData() {
    try {
      [this.settings, this.analytics, this.goals, this.tokenUsage] = await Promise.all([
        StorageManager.getSettings(),
        StorageManager.getAnalytics(),
        StorageManager.getGoals(),
        StorageManager.getTokenUsage(7) // Last 7 days
      ]);

      console.log('[Focus Guard] Options page loaded settings:', this.settings);
      this.updateUI();
    } catch (error) {
      Utils.log('error', 'Failed to load options data', error);
      this.showStatus('Failed to load settings', 'error');
    }
  }

  /**
   * Update the entire UI
   */
  updateUI() {
    this.updateProviderSelection();
    this.updateModelSelection();
    this.updateApiKey();
    this.updateThreshold();
    this.updateExtensionToggle();
    this.updateAdvancedSettings();
    this.updateStatistics();
    this.updateTokenUsage();
    this.updateProviderDocs();
  }

  /**
   * Update provider selection
   */
  updateProviderSelection() {
    const providerSelect = document.getElementById('provider-select');
    providerSelect.value = this.settings.provider || '';
    // Don't call handleProviderChange during initialization - it resets model/apiKey
    // Just update the dependent UI elements directly
    this.updateModelSelection();
    this.updateApiKey();
    this.updateProviderDocs();
  }

  /**
   * Update model selection based on provider
   */
  updateModelSelection() {
    const modelSelect = document.getElementById('model-select');
    const provider = this.settings.provider;

    if (!provider || !CONSTANTS.PROVIDERS[provider]) {
      modelSelect.disabled = true;
      modelSelect.innerHTML = '<option value="">Select a model...</option>';
      return;
    }

    modelSelect.disabled = false;
    const models = CONSTANTS.PROVIDERS[provider].models;
    
    modelSelect.innerHTML = models.map(model => 
      `<option value="${model}" ${model === this.settings.model ? 'selected' : ''}>${model}</option>`
    ).join('');
  }

  /**
   * Update API key field
   */
  updateApiKey() {
    const apiKeyInput = document.getElementById('api-key');
    const toggleBtn = document.getElementById('toggle-key-visibility');
    
    if (this.settings.provider && CONSTANTS.PROVIDERS[this.settings.provider]?.keyRequired) {
      apiKeyInput.disabled = false;
      toggleBtn.disabled = false;
      apiKeyInput.value = this.settings.apiKey || '';
    } else {
      apiKeyInput.disabled = true;
      toggleBtn.disabled = true;
      apiKeyInput.value = '';
    }
  }

  /**
   * Update confidence threshold
   */
  updateThreshold() {
    const thresholdSlider = document.getElementById('confidence-threshold');
    const thresholdValue = document.getElementById('threshold-value');
    
    const threshold = this.settings.confidenceThreshold || CONSTANTS.DEFAULT_SETTINGS.confidenceThreshold;
    thresholdSlider.value = threshold;
    thresholdValue.textContent = threshold;
  }

  /**
   * Update extension toggle
   */
  updateExtensionToggle() {
    const enableCheckbox = document.getElementById('enable-extension');
    enableCheckbox.checked = this.settings.enabled !== false;
  }

  /**
   * Update advanced settings
   */
  updateAdvancedSettings() {
    const rateLimitInput = document.getElementById('rate-limit');
    const cacheCheckbox = document.getElementById('enable-cache');
    
    rateLimitInput.value = this.settings.rateLimit?.requestsPerMinute || 20;
    cacheCheckbox.checked = this.settings.enableCache !== false;
  }

  /**
   * Update statistics display
   */
  updateStatistics() {
    document.getElementById('total-requests').textContent = this.analytics.totalRequests || 0;
    document.getElementById('blocked-pages').textContent = this.analytics.blockedPages || 0;
    document.getElementById('bypassed-pages').textContent = this.analytics.bypassedPages || 0;
    document.getElementById('current-goals').textContent = this.goals.length || 0;
  }

  /**
   * Update token usage display
   */
  updateTokenUsage() {
    try {
      const totalUsage = StorageManager.calculateTotalTokenUsage(this.tokenUsage || {});
      
      // Update total token stats
      document.getElementById('total-input-tokens').textContent = 
        this.formatTokenCount(totalUsage.inputTokens);
      document.getElementById('total-output-tokens').textContent = 
        this.formatTokenCount(totalUsage.outputTokens);
      document.getElementById('total-api-requests').textContent = 
        totalUsage.requests.toLocaleString();
      
      // Update provider breakdown
      this.updateProviderBreakdown(totalUsage.byProvider);
    } catch (error) {
      console.error('[Focus Guard] Failed to update token usage:', error);
    }
  }

  /**
   * Update provider breakdown display
   */
  updateProviderBreakdown(providerUsage) {
    const breakdownContainer = document.getElementById('provider-breakdown');
    
    if (!providerUsage || Object.keys(providerUsage).length === 0) {
      breakdownContainer.innerHTML = '<div class="no-usage">No token usage data yet</div>';
      return;
    }
    
    const providers = Object.entries(providerUsage)
      .filter(([_, usage]) => usage.requests > 0)
      .sort(([, a], [, b]) => b.totalTokens - a.totalTokens);
    
    if (providers.length === 0) {
      breakdownContainer.innerHTML = '<div class="no-usage">No token usage data yet</div>';
      return;
    }
    
    breakdownContainer.innerHTML = providers.map(([provider, usage]) => `
      <div class="provider-usage">
        <div class="provider-name">${this.getProviderDisplayName(provider)}</div>
        <div class="provider-stats">
          <span class="provider-stat">
            <span class="stat-number">${this.formatTokenCount(usage.inputTokens)}</span>
            <span class="stat-label">in</span>
          </span>
          <span class="provider-stat">
            <span class="stat-number">${this.formatTokenCount(usage.outputTokens)}</span>
            <span class="stat-label">out</span>
          </span>
          <span class="provider-stat">
            <span class="stat-number">${usage.requests.toLocaleString()}</span>
            <span class="stat-label">requests</span>
          </span>
        </div>
      </div>
    `).join('');
  }

  /**
   * Format token count for display
   */
  formatTokenCount(count) {
    if (count >= 1000000) {
      return (count / 1000000).toFixed(1) + 'M';
    } else if (count >= 1000) {
      return (count / 1000).toFixed(1) + 'K';
    }
    return count.toLocaleString();
  }

  /**
   * Get display name for provider
   */
  getProviderDisplayName(provider) {
    const displayNames = {
      openrouter: 'OpenRouter',
      openai: 'OpenAI',
      anthropic: 'Anthropic'
    };
    return displayNames[provider] || provider;
  }

  /**
   * Update provider documentation link
   */
  updateProviderDocs() {
    const docsLink = document.getElementById('provider-docs-link');
    const provider = this.settings.provider;
    
    const docUrls = {
      openrouter: 'https://openrouter.ai/keys',
      openai: 'https://platform.openai.com/api-keys',
      anthropic: 'https://console.anthropic.com/dashboard'
    };
    
    if (provider && docUrls[provider]) {
      docsLink.href = docUrls[provider];
      docsLink.style.display = 'inline';
    } else {
      docsLink.style.display = 'none';
    }
  }

  /**
   * Handle provider change
   */
  handleProviderChange(provider) {
    // Update settings immediately for UI updates
    this.settings.provider = provider;
    this.settings.model = ''; // Reset model when provider changes  
    this.settings.apiKey = ''; // Reset API key when provider changes
    
    // Update UI immediately with new provider
    this.updateModelSelection();
    this.updateApiKey();
    this.updateProviderDocs();
    
    // Save to storage with debounce
    this.debouncedSave({
      provider: provider,
      model: '',
      apiKey: ''
    });
  }

  /**
   * Handle model change
   */
  handleModelChange(model) {
    // Update settings immediately for UI consistency
    this.settings.model = model;
    
    // Save to storage with debounce
    this.debouncedSave({ model });
  }

  /**
   * Handle API key change
   */
  handleApiKeyChange() {
    const apiKey = document.getElementById('api-key').value;
    
    // Update settings immediately for UI consistency
    this.settings.apiKey = apiKey;
    
    // Save to storage with debounce
    this.debouncedSave({ apiKey });
    this.clearApiStatus();
  }

  /**
   * Handle threshold change
   */
  handleThresholdChange(threshold) {
    document.getElementById('threshold-value').textContent = threshold;
    this.debouncedSave({ confidenceThreshold: threshold });
  }

  /**
   * Handle extension toggle
   */
  handleExtensionToggle(enabled) {
    this.debouncedSave({ enabled });
  }

  /**
   * Handle rate limit change
   */
  handleRateLimitChange(requestsPerMinute) {
    this.debouncedSave({
      rateLimit: {
        ...this.settings.rateLimit,
        requestsPerMinute
      }
    });
  }

  /**
   * Handle cache toggle
   */
  handleCacheToggle(enableCache) {
    this.debouncedSave({ enableCache });
  }

  /**
   * Validate API key
   */
  async validateApiKey() {
    const provider = this.settings.provider;
    const apiKey = this.settings.apiKey;

    if (!provider || !apiKey) {
      return;
    }

    this.showApiStatus('Testing API connection...', 'loading');

    try {
      // Send validation request to background script
      const response = await chrome.runtime.sendMessage({
        type: 'VALIDATE_API_KEY',
        payload: { provider, apiKey }
      });

      if (response.success) {
        this.showApiStatus('API key validated successfully!', 'success');
      } else {
        this.showApiStatus(response.error || 'API key validation failed', 'error');
      }
    } catch (error) {
      Utils.log('error', 'API validation failed', error);
      this.showApiStatus('Failed to validate API key', 'error');
    }
  }

  /**
   * Toggle API key visibility
   */
  toggleKeyVisibility() {
    const apiKeyInput = document.getElementById('api-key');
    const toggleBtn = document.getElementById('toggle-key-visibility');
    
    if (apiKeyInput.type === 'password') {
      apiKeyInput.type = 'text';
      toggleBtn.textContent = '🙈';
    } else {
      apiKeyInput.type = 'password';
      toggleBtn.textContent = '👁️';
    }
  }

  /**
   * Show API status
   */
  showApiStatus(message, type) {
    const statusElement = document.getElementById('api-status');
    const iconElement = document.getElementById('status-icon');
    const messageElement = document.getElementById('status-message');

    const icons = {
      loading: '⏳',
      success: '✅',
      error: '❌',
      warning: '⚠️'
    };

    statusElement.className = `status-indicator ${type}`;
    statusElement.classList.remove('hidden');
    iconElement.textContent = icons[type] || '❓';
    messageElement.textContent = message;

    // Auto-hide after 5 seconds for success/error
    if (type === 'success' || type === 'error') {
      setTimeout(() => {
        statusElement.classList.add('hidden');
      }, 5000);
    }
  }

  /**
   * Clear API status
   */
  clearApiStatus() {
    const statusElement = document.getElementById('api-status');
    statusElement.classList.add('hidden');
  }

  /**
   * Reset statistics
   */
  async resetStatistics() {
    if (!confirm('Are you sure you want to reset all statistics? This cannot be undone.')) {
      return;
    }

    try {
      await StorageManager.updateAnalytics({
        totalRequests: -this.analytics.totalRequests,
        blockedPages: -this.analytics.blockedPages,
        bypassedPages: -this.analytics.bypassedPages
      });

      this.analytics = { totalRequests: 0, blockedPages: 0, bypassedPages: 0 };
      this.updateStatistics();
      this.showStatus('Statistics reset successfully', 'saved');
    } catch (error) {
      Utils.log('error', 'Failed to reset statistics', error);
      this.showStatus('Failed to reset statistics', 'error');
    }
  }

  /**
   * Export data
   */
  async exportData() {
    try {
      const data = await StorageManager.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `focus-guard-settings-${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      
      URL.revokeObjectURL(url);
      this.showStatus('Settings exported successfully', 'saved');
    } catch (error) {
      Utils.log('error', 'Failed to export data', error);
      this.showStatus('Failed to export settings', 'error');
    }
  }

  /**
   * Import data
   */
  async importData(file) {
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      await StorageManager.importData(data);
      
      // Reload data and update UI
      await this.loadData();
      this.showStatus('Settings imported successfully', 'saved');
    } catch (error) {
      Utils.log('error', 'Failed to import data', error);
      this.showStatus('Failed to import settings. Please check the file format.', 'error');
    }
  }

  /**
   * Reset all data
   */
  async resetAllData() {
    if (!confirm('Are you sure you want to reset ALL extension data? This will delete your goals, settings, and statistics. This cannot be undone.')) {
      return;
    }

    const secondConfirm = prompt('Type "RESET" to confirm deletion of all data:');
    if (secondConfirm !== 'RESET') {
      return;
    }

    try {
      await StorageManager.clearAllData();
      
      // Reload default settings
      await this.loadData();
      this.showStatus('All data reset successfully', 'saved');
    } catch (error) {
      Utils.log('error', 'Failed to reset all data', error);
      this.showStatus('Failed to reset data', 'error');
    }
  }

  /**
   * Debounced save function
   */
  debouncedSave(updates) {
    this.showStatus('Saving...', 'saving');
    
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    this.saveTimeout = setTimeout(async () => {
      try {
        this.settings = await StorageManager.setSettings(updates);
        this.showStatus('All changes saved', 'saved');
      } catch (error) {
        Utils.log('error', 'Failed to save settings', error);
        this.showStatus('Failed to save changes', 'error');
      }
    }, 500);
  }

  /**
   * Show save status
   */
  showStatus(message, type) {
    const statusElement = document.getElementById('save-status');
    statusElement.textContent = message;
    statusElement.className = `save-indicator ${type}`;
  }
}

// Initialize options page when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new OptionsController();
});