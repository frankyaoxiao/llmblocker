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
    this.whitelist = [];
    this.saveTimeout = null;
    this.providerSettings = {}; // Store per-provider settings
    this.currentTab = 'ai-provider';
    
    this.initializeEventListeners();
    this.loadData();
  }

  /**
   * Initialize all event listeners
   */
  initializeEventListeners() {
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.switchTab(e.target.dataset.tab);
      });
    });

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

    // Whitelist management
    document.getElementById('add-domain-btn').addEventListener('click', () => {
      this.handleAddDomain();
    });
    
    document.getElementById('domain-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.handleAddDomain();
      }
    });
    
    document.getElementById('domain-input').addEventListener('input', () => {
      this.clearDomainError();
    });
  }

  /**
   * Load initial data
   */
  async loadData() {
    try {
      [this.settings, this.analytics, this.goals, this.whitelist, this.tokenUsage] = await Promise.all([
        StorageManager.getSettings(),
        StorageManager.getAnalytics(),
        StorageManager.getGoals(),
        StorageManager.getWhitelist(),
        StorageManager.getTokenUsage(7) // Last 7 days
      ]);

      // Initialize provider settings cache with current settings
      if (this.settings.provider) {
        this.providerSettings[this.settings.provider] = {
          model: this.settings.model || '',
          apiKey: this.settings.apiKey || ''
        };
      }

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
    this.updateWhitelist();
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
   * Get default model for a provider
   */
  getDefaultModelForProvider(provider) {
    const defaults = {
      openrouter: 'openai/gpt-5-mini',
      openai: 'gpt-5-mini',
      anthropic: 'claude-sonnet-4'
    };
    return defaults[provider] || '';
  }

  /**
   * Switch to a different tab
   */
  switchTab(tabId) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.toggle('active', content.id === `${tabId}-tab`);
    });
    
    this.currentTab = tabId;
  }

  /**
   * Update whitelist display
   */
  updateWhitelist() {
    const count = this.whitelist.length;
    const maxCount = CONSTANTS.UI.MAX_WHITELIST_COUNT;
    
    // Update count
    document.getElementById('whitelist-count').textContent = count;
    
    // Update list
    const listContainer = document.getElementById('whitelist-list');
    const emptyState = document.getElementById('empty-whitelist');
    
    if (count === 0) {
      listContainer.style.display = 'none';
      emptyState.style.display = 'block';
    } else {
      listContainer.style.display = 'block';
      emptyState.style.display = 'none';
      
      listContainer.innerHTML = this.whitelist.map(domain => `
        <div class="whitelist-item">
          <span class="whitelist-domain">${domain}</span>
          <button class="whitelist-remove" data-domain="${domain}">Remove</button>
        </div>
      `).join('');
      
      // Add remove event listeners
      listContainer.querySelectorAll('.whitelist-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
          this.handleRemoveDomain(e.target.dataset.domain);
        });
      });
    }
    
    // Update add button state
    const addBtn = document.getElementById('add-domain-btn');
    addBtn.disabled = count >= maxCount;
  }

  /**
   * Handle adding domain to whitelist
   */
  async handleAddDomain() {
    const input = document.getElementById('domain-input');
    const domain = input.value.trim();
    
    if (!domain) {
      this.showDomainError('Please enter a domain');
      return;
    }
    
    try {
      this.whitelist = await StorageManager.addToWhitelist(domain);
      input.value = '';
      this.updateWhitelist();
      this.clearDomainError();
      this.showStatus('Domain added to whitelist', 'saved');
    } catch (error) {
      console.error('[Focus Guard] Failed to add domain:', error);
      this.showDomainError(error.message);
    }
  }

  /**
   * Handle removing domain from whitelist
   */
  async handleRemoveDomain(domain) {
    try {
      this.whitelist = await StorageManager.removeFromWhitelist(domain);
      this.updateWhitelist();
      this.showStatus('Domain removed from whitelist', 'saved');
    } catch (error) {
      console.error('[Focus Guard] Failed to remove domain:', error);
      this.showStatus('Failed to remove domain', 'error');
    }
  }

  /**
   * Show domain error message
   */
  showDomainError(message) {
    const errorElement = document.getElementById('domain-error');
    errorElement.textContent = message;
    errorElement.classList.remove('hidden');
  }

  /**
   * Clear domain error message
   */
  clearDomainError() {
    const errorElement = document.getElementById('domain-error');
    errorElement.classList.add('hidden');
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
    // Save current provider's settings before switching
    if (this.settings.provider) {
      this.providerSettings[this.settings.provider] = {
        model: this.settings.model || '',
        apiKey: this.settings.apiKey || ''
      };
    }
    
    // Update provider
    this.settings.provider = provider;
    
    // Restore settings for the new provider if they exist
    const savedSettings = this.providerSettings[provider];
    if (savedSettings) {
      this.settings.model = savedSettings.model;
      this.settings.apiKey = savedSettings.apiKey;
    } else {
      // Set defaults for new provider
      this.settings.model = this.getDefaultModelForProvider(provider);
      this.settings.apiKey = '';
    }
    
    // Update UI immediately with new provider
    this.updateModelSelection();
    this.updateApiKey();
    this.updateProviderDocs();
    
    // Save to storage with debounce
    this.debouncedSave({
      provider: provider,
      model: this.settings.model,
      apiKey: this.settings.apiKey
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