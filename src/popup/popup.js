// Firefox compatibility: ensure chrome API is available
if (typeof browser !== 'undefined' && typeof chrome === 'undefined') {
  globalThis.chrome = browser;
}

/**
 * Popup UI Controller
 */
class PopupController {
  constructor() {
    this.goals = [];
    this.settings = {};
    this.analytics = {};
    
    this.initializeEventListeners();
    this.loadData();
  }

  /**
   * Initialize all event listeners
   */
  initializeEventListeners() {
    // Goal input handling
    const goalInput = document.getElementById('goal-input');
    const addGoalBtn = document.getElementById('add-goal-btn');
    
    goalInput.addEventListener('input', () => this.handleGoalInputChange());
    goalInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !addGoalBtn.disabled) {
        this.addGoal();
      }
    });
    
    addGoalBtn.addEventListener('click', () => this.addGoal());

    // Extension toggle
    document.getElementById('toggle-extension').addEventListener('click', () => {
      this.toggleExtension();
    });

    // Settings button
    document.getElementById('settings-btn').addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });
  }

  /**
   * Load initial data
   */
  async loadData() {
    try {
      [this.goals, this.settings, this.analytics] = await Promise.all([
        StorageManager.getGoals(),
        StorageManager.getSettings(),
        StorageManager.getAnalytics()
      ]);

      this.updateUI();
    } catch (error) {
      Utils.log('error', 'Failed to load popup data', error);
      this.showError('Failed to load data. Please try again.');
    }
  }

  /**
   * Update the entire UI
   */
  updateUI() {
    this.updateExtensionStatus();
    this.updateGoalsList();
    this.updateGoalsCount();
    this.updateStats();
    this.updateGoalInput();
  }

  /**
   * Update extension status indicator
   */
  updateExtensionStatus() {
    const statusDot = document.getElementById('status-dot');
    const statusText = document.getElementById('status-text');
    const toggleBtn = document.getElementById('toggle-extension');
    const toggleText = document.getElementById('toggle-text');

    if (this.settings.enabled) {
      statusDot.className = 'status-dot enabled';
      statusText.textContent = 'Enabled';
      toggleBtn.className = 'toggle-btn enabled';
      toggleText.textContent = 'Disable Extension';
    } else {
      statusDot.className = 'status-dot disabled';
      statusText.textContent = 'Disabled';
      toggleBtn.className = 'toggle-btn disabled';
      toggleText.textContent = 'Enable Extension';
    }
  }

  /**
   * Update goals list display
   */
  updateGoalsList() {
    const goalsList = document.getElementById('goals-list');
    const emptyState = document.getElementById('empty-goals');

    if (this.goals.length === 0) {
      goalsList.style.display = 'none';
      emptyState.style.display = 'block';
      return;
    }

    goalsList.style.display = 'flex';
    emptyState.style.display = 'none';

    goalsList.innerHTML = this.goals.map(goal => this.createGoalHTML(goal)).join('');

    // Add event listeners to delete buttons
    goalsList.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const goalId = e.target.closest('.goal-item').dataset.goalId;
        this.removeGoal(goalId);
      });
    });
  }

  /**
   * Create HTML for a single goal item
   */
  createGoalHTML(goal) {
    const createdDate = new Date(goal.createdAt).toLocaleDateString();
    
    return `
      <div class="goal-item" data-goal-id="${goal.id}">
        <div class="goal-content">
          <div class="goal-text">${this.escapeHtml(goal.text)}</div>
          <div class="goal-meta">${createdDate}</div>
        </div>
        <div class="goal-actions">
          <button class="goal-btn delete-btn" title="Remove goal">×</button>
        </div>
      </div>
    `;
  }

  /**
   * Update goals counter
   */
  updateGoalsCount() {
    const goalsCount = document.getElementById('goals-count');
    goalsCount.textContent = `${this.goals.length}/${CONSTANTS.UI.MAX_GOALS_COUNT}`;
  }

  /**
   * Update statistics display
   */
  updateStats() {
    document.getElementById('pages-analyzed').textContent = 
      `Pages analyzed: ${this.analytics.totalRequests || 0}`;
    document.getElementById('pages-blocked').textContent = 
      `Blocked: ${this.analytics.blockedPages || 0}`;
  }

  /**
   * Update goal input state
   */
  updateGoalInput() {
    const goalInput = document.getElementById('goal-input');
    const addGoalBtn = document.getElementById('add-goal-btn');
    
    const inputValue = goalInput.value.trim();
    const canAdd = inputValue.length > 0 && 
                   inputValue.length <= CONSTANTS.UI.MAX_GOAL_LENGTH &&
                   this.goals.length < CONSTANTS.UI.MAX_GOALS_COUNT;
    
    addGoalBtn.disabled = !canAdd;
  }

  /**
   * Handle goal input changes
   */
  handleGoalInputChange() {
    this.updateGoalInput();
    this.clearError();
  }

  /**
   * Add a new goal
   */
  async addGoal() {
    const goalInput = document.getElementById('goal-input');
    const goalText = goalInput.value.trim();

    if (!goalText) {
      this.showError('Please enter a goal.');
      return;
    }

    if (goalText.length > CONSTANTS.UI.MAX_GOAL_LENGTH) {
      this.showError(`Goal cannot exceed ${CONSTANTS.UI.MAX_GOAL_LENGTH} characters.`);
      return;
    }

    if (this.goals.length >= CONSTANTS.UI.MAX_GOALS_COUNT) {
      this.showError(`You can only have up to ${CONSTANTS.UI.MAX_GOALS_COUNT} goals.`);
      return;
    }

    try {
      this.setLoading(true);
      
      const newGoal = await StorageManager.addGoal(goalText);
      this.goals.push(newGoal);
      
      goalInput.value = '';
      this.updateUI();
      this.clearError();
      
      Utils.log('info', 'Goal added successfully', { goalId: newGoal.id, text: goalText });
    } catch (error) {
      Utils.log('error', 'Failed to add goal', error);
      this.showError(error.message || 'Failed to add goal. Please try again.');
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * Remove a goal
   */
  async removeGoal(goalId) {
    try {
      this.setLoading(true);
      
      const success = await StorageManager.removeGoal(goalId);
      if (success) {
        this.goals = this.goals.filter(goal => goal.id !== goalId);
        this.updateUI();
        
        Utils.log('info', 'Goal removed successfully', { goalId });
      } else {
        throw new Error('Failed to remove goal');
      }
    } catch (error) {
      Utils.log('error', 'Failed to remove goal', error);
      this.showError('Failed to remove goal. Please try again.');
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * Toggle extension enabled/disabled
   */
  async toggleExtension() {
    try {
      this.setLoading(true);
      
      const newSettings = await StorageManager.setSettings({
        enabled: !this.settings.enabled
      });
      
      this.settings = newSettings;
      this.updateExtensionStatus();
      
      // Notify background script
      chrome.runtime.sendMessage({
        type: CONSTANTS.MESSAGE_TYPES.TOGGLE_EXTENSION,
        payload: { enabled: newSettings.enabled }
      });
      
      Utils.log('info', 'Extension toggled', { enabled: newSettings.enabled });
    } catch (error) {
      Utils.log('error', 'Failed to toggle extension', error);
      this.showError('Failed to toggle extension. Please try again.');
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * Show error message
   */
  showError(message) {
    const errorElement = document.getElementById('input-error');
    errorElement.textContent = message;
    errorElement.classList.remove('hidden');
  }

  /**
   * Clear error message
   */
  clearError() {
    const errorElement = document.getElementById('input-error');
    errorElement.classList.add('hidden');
  }

  /**
   * Set loading state
   */
  setLoading(loading) {
    const addGoalBtn = document.getElementById('add-goal-btn');
    const toggleBtn = document.getElementById('toggle-extension');
    const goalInput = document.getElementById('goal-input');

    if (loading) {
      addGoalBtn.disabled = true;
      toggleBtn.disabled = true;
      goalInput.disabled = true;
    } else {
      goalInput.disabled = false;
      toggleBtn.disabled = false;
      this.updateGoalInput(); // This will set the correct state for add button
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

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});