// Application constants
export const CONSTANTS = {
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
    provider: 'openrouter',
    model: 'openai/gpt-5-mini',
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
        'openai/gpt-4o',
        'openai/gpt-4o-mini',
        'anthropic/claude-3-5-sonnet',
        'meta-llama/llama-3.1-70b-instruct',
        'google/gemini-pro-1.5'
      ],
      keyRequired: true
    },
    openai: {
      name: 'OpenAI',
      baseUrl: 'https://api.openai.com/v1',
      models: [
        'gpt-5',
        'gpt-5-mini',
        'gpt-5-nano', 
        'gpt-5-chat-latest',
        'gpt-4o',
        'gpt-4o-mini'
      ],
      keyRequired: true
    },
    anthropic: {
      name: 'Anthropic',
      baseUrl: 'https://api.anthropic.com',
      models: [
        'claude-opus-4.1',
        'claude-sonnet-4',
        'claude-3-5-sonnet-20241022',
        'claude-3-5-haiku-20241022'
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
export const ANALYSIS_PROMPT = `TASK: Analyze if this webpage aligns with the user's current goals.

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

Rate from 0-100 how well this webpage supports the user's goals:
- 0-20: Actively distracts from goals (social media, entertainment unrelated to goals)
- 21-40: Likely distracts or provides no value toward goals  
- 41-60: Neutral or unclear relationship to goals
- 61-80: Likely helpful for achieving goals
- 81-100: Directly supports goal achievement

Think through your reasoning, then respond with only the final number (0-100).`;