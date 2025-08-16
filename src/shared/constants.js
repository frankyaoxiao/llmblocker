// Firefox compatibility: ensure chrome API is available
if (typeof browser !== 'undefined' && typeof chrome === 'undefined') {
  globalThis.chrome = browser;
}

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
const ANALYSIS_PROMPT = `TASK: Analyze if this webpage aligns with the user's current goals.

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