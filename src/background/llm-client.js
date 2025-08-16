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

  async validateCredentials() {
    throw new Error('validateCredentials must be implemented by subclass');
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

  async validateCredentials() {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: this.getHeaders()
      });
      return response.ok;
    } catch (error) {
      Utils.log('error', 'OpenRouter validation failed', error);
      return false;
    }
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

  async validateCredentials() {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: this.getHeaders()
      });
      return response.ok;
    } catch (error) {
      Utils.log('error', 'OpenAI validation failed', error);
      return false;
    }
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

  async validateCredentials() {
    try {
      // Test with a minimal request
      const response = await fetch(`${this.baseUrl}/v1/messages`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          model: this.model,
          max_tokens: 1,
          messages: [{ role: 'user', content: 'Hi' }]
        })
      });
      return response.ok;
    } catch (error) {
      Utils.log('error', 'Anthropic validation failed', error);
      return false;
    }
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
        Utils.log('info', 'No goals set, allowing page');
        return {
          confidence: 0,
          shouldBlock: false,
          reasoning: 'No goals configured'
        };
      }

      // Check rate limiting
      if (Utils.isRateLimited(settings)) {
        Utils.log('warn', 'Rate limit exceeded, allowing page');
        return {
          confidence: 0,
          shouldBlock: false,
          reasoning: 'Rate limit exceeded'
        };
      }

      // Check cache
      const cacheKey = Utils.generateCacheKey(window.location?.href || '', content, goals);
      if (this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey);
        if (Date.now() - cached.timestamp < CONSTANTS.API.CACHE_DURATION) {
          Utils.log('info', 'Using cached analysis result');
          return cached.result;
        } else {
          this.cache.delete(cacheKey);
        }
      }

      // Create prompt
      const prompt = Utils.createAnalysisPrompt(title, content, goals);
      
      Utils.log('info', 'Sending LLM analysis request', {
        provider: settings.provider,
        model: settings.model,
        promptLength: prompt.length
      });

      // Create provider and make request
      const provider = this.createProvider(settings.provider, settings.apiKey, settings.model);
      
      const startTime = Date.now();
      const response = await Promise.race([
        provider.makeRequest(prompt),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), CONSTANTS.API.TIMEOUT)
        )
      ]);
      const duration = Date.now() - startTime;

      Utils.log('info', 'LLM response received', { duration, response });

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

      // Cache result
      this.cache.set(cacheKey, {
        result,
        timestamp: Date.now()
      });

      return result;

    } catch (error) {
      Utils.log('error', 'LLM analysis failed', error);
      
      // Fail-open: allow page when analysis fails
      return {
        confidence: 0,
        shouldBlock: false,
        reasoning: `Analysis failed: ${error.message}`,
        error: error.message
      };
    }
  }

  /**
   * Validate API credentials
   */
  async validateCredentials(provider, apiKey, model) {
    try {
      if (!provider || !apiKey) {
        return { success: false, error: 'Provider and API key required' };
      }

      const providerInstance = this.createProvider(provider, apiKey, model);
      const isValid = await providerInstance.validateCredentials();

      if (isValid) {
        return { success: true };
      } else {
        return { success: false, error: 'Invalid API credentials' };
      }
    } catch (error) {
      Utils.log('error', 'Credential validation failed', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get available providers
   */
  getProviders() {
    return CONSTANTS.PROVIDERS;
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
    Utils.log('info', 'LLM cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    const now = Date.now();
    let validEntries = 0;
    let expiredEntries = 0;

    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp < CONSTANTS.API.CACHE_DURATION) {
        validEntries++;
      } else {
        expiredEntries++;
        this.cache.delete(key); // Clean up expired entries
      }
    }

    return {
      totalEntries: this.cache.size,
      validEntries,
      expiredEntries
    };
  }
}