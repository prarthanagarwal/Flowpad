// ===== AI SERVICE MODULE =====
// Handles Gemini API integration and AI-powered functionality

const { GoogleGenerativeAI } = require('@google/generative-ai');

class AIService {
  constructor() {
    this.genAI = null;
    this.model = null;
    this.apiKey = null;
  }

  // Initialize the AI service with API key
  initialize(apiKey) {
    try {
      if (!apiKey) {
        throw new Error('API key is required');
      }

      this.apiKey = apiKey;
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048,
        }
      });

      console.log('AI service initialized successfully');
      return { success: true };
    } catch (error) {
      console.error('Error initializing AI service:', error);
      return { success: false, error: error.message };
    }
  }

  // Generate AI response based on user prompt and context
  async generateResponse(prompt, context = '') {
    try {
      if (!this.model) {
        throw new Error('AI service not initialized. Please configure your API key in settings.');
      }

      // Build context-aware prompt
      let fullPrompt = prompt;

      if (context) {
        fullPrompt = `Context: ${context}\n\nRequest: ${prompt}`;
      }

      // Add system instructions for note-taking context
      const systemPrompt = `You are an AI assistant helping with note-taking and writing. Provide helpful, concise responses that assist with writing, editing, organizing, or generating content for notes.

${fullPrompt}`;

      const result = await this.model.generateContent(systemPrompt);
      const response = await result.response;
      const text = response.text();

      return { success: true, response: text };
    } catch (error) {
      console.error('Error generating AI response:', error);

      let errorMessage = 'Failed to generate AI response';
      if (error.message.includes('API_KEY_INVALID')) {
        errorMessage = 'Invalid API key. Please check your Gemini API key in settings.';
      } else if (error.message.includes('QUOTA_EXCEEDED')) {
        errorMessage = 'API quota exceeded. Please try again later.';
      } else if (error.message.includes('PERMISSION_DENIED')) {
        errorMessage = 'Permission denied. Please check your API key permissions.';
      }

      return { success: false, error: errorMessage };
    }
  }

  // Generate suggestions for note content
  async suggestContent(content, suggestionType = 'general') {
    try {
      if (!this.model) {
        throw new Error('AI service not initialized');
      }

      let prompt = '';

      switch (suggestionType) {
        case 'expand':
          prompt = `Expand on this note content with additional details, examples, or related ideas:\n\n${content}`;
          break;
        case 'summarize':
          prompt = `Create a concise summary of this note content:\n\n${content}`;
          break;
        case 'improve':
          prompt = `Improve the writing, clarity, and structure of this note content:\n\n${content}`;
          break;
        case 'brainstorm':
          prompt = `Generate ideas and brainstorm related topics for this note:\n\n${content}`;
          break;
        case 'todo':
          prompt = `Convert this content into a structured todo list:\n\n${content}`;
          break;
        default:
          prompt = `Provide helpful suggestions or improvements for this note content:\n\n${content}`;
      }

      const result = await this.generateResponse(prompt);
      return result;
    } catch (error) {
      console.error('Error generating content suggestions:', error);
      return { success: false, error: error.message };
    }
  }

  // Check if the service is properly configured
  isConfigured() {
    return this.genAI !== null && this.apiKey !== null;
  }

  // Get current configuration status
  getStatus() {
    return {
      configured: this.isConfigured(),
      hasApiKey: this.apiKey !== null,
      modelReady: this.model !== null
    };
  }
}

// Export singleton instance
const aiService = new AIService();

module.exports = {
  AIService,
  aiService
};
