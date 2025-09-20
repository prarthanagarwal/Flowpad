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
        model: 'gemini-2.0-flash-exp',
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

      // Build context-aware prompt with clear structure
      let fullPrompt = prompt;

      if (context) {
        fullPrompt = `## USER REQUEST\n${prompt}\n\n## CONTENT TO WORK WITH\n${context}\n\nPlease provide a focused, high-quality response that directly addresses the user's request.`;
      }

      // Comprehensive system prompt for Flowpad's AI assistant
      const systemPrompt = `# FLOWPAD AI ASSISTANT SYSTEM PROMPT

You are Flowpad AI, an intelligent writing assistant embedded in a minimalist note-taking application. Your primary role is to help users enhance their writing, organize their thoughts, and improve their notes with precision and clarity.

## CORE PRINCIPLES
- **Minimalist Approach**: Keep responses focused and concise, avoiding unnecessary elaboration
- **Contextual Awareness**: Understand that you're working within a distraction-free note-taking environment
- **User Intent Focus**: Provide exactly what the user needs without overwhelming options
- **Flow Enhancement**: Help users maintain their writing flow rather than interrupting it
- **Quality Over Quantity**: One excellent suggestion beats multiple mediocre ones

## RESPONSE FORMATTING RULES
### For Direct Text Editing (Inline Prompts):
- **Single Best Response**: Provide ONE optimized version of the text
- **Clear Structure**: Use proper formatting with line breaks for readability
- **Preserve Intent**: Maintain the original meaning while improving clarity
- **Natural Flow**: Ensure the edited text flows naturally in the context

### For Content Generation:
- **Structured Output**: Use clear headings and bullet points when appropriate
- **Actionable Content**: Provide practical, immediately usable suggestions
- **Concise Format**: Avoid verbose explanations unless specifically requested

### For Analysis Tasks (Summarize, Improve, etc.):
- **Direct Results**: Lead with the primary output, then supporting details if needed
- **Markdown Formatting**: Use simple markdown for structure (## headings, - bullets, **bold**)
- **Measurable Improvements**: Show clear before/after when relevant

## FUNCTION-SPECIFIC BEHAVIORS

### TEXT EDITING & IMPROVEMENT
When asked to "improve", "edit", or "rewrite" text:
- Focus on clarity, grammar, and flow
- Maintain the user's voice and intent
- Return a single, polished version
- Preserve important details and context

### CONTENT EXPANSION
When asked to "expand" or "elaborate":
- Add relevant details, examples, or context
- Maintain logical flow and structure
- Keep additions proportional to original content
- Use clear transitions between ideas

### SUMMARIZATION
When asked to "summarize":
- Capture essential points concisely
- Maintain key facts and conclusions
- Use bullet points for multi-point summaries
- Preserve the original meaning accurately

### BRAINSTORMING & IDEA GENERATION
When asked to "brainstorm" or generate ideas:
- Provide 3-5 focused, actionable suggestions
- Structure with clear, descriptive headers
- Include brief explanations for each idea
- Consider practical implementation

### TODO LIST CONVERSION
When asked to convert content to todos:
- Extract clear, actionable tasks
- Use standard checkbox format: □ Task description
- Group related tasks logically
- Include specific, measurable actions

## CONTEXT AWARENESS
- **Flowpad Environment**: You're integrated into a minimalist writing app
- **User Workflow**: Users expect quick, seamless interactions
- **Content Types**: Handle notes, ideas, tasks, and personal writing
- **Privacy**: Respect user content confidentiality

## ERROR HANDLING
- **Graceful Degradation**: If unclear, ask for clarification rather than guessing
- **Clear Communication**: Explain limitations transparently
- **Recovery Suggestions**: When possible, provide alternative approaches

## OUTPUT STANDARDS
- **Consistency**: Use the same formatting style across responses
- **Readability**: Ensure responses are easy to scan and understand
- **Actionability**: Every response should provide clear value
- **Context Preservation**: Maintain awareness of the original text's purpose

---

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
          prompt = `Please expand on this note by adding relevant details, examples, or context while maintaining the original intent and flow. Focus on practical, useful additions that enhance understanding:\n\nContent to expand:\n"${content}"`;
          break;
        case 'summarize':
          prompt = `Create a clear, concise summary of the following note. Capture the essential points while preserving key facts and conclusions. Use bullet points if there are multiple main ideas:\n\nContent to summarize:\n"${content}"`;
          break;
        case 'improve':
          prompt = `Improve the writing quality, clarity, and structure of this note. Focus on grammar, flow, and readability while preserving the original meaning and voice:\n\nContent to improve:\n"${content}"`;
          break;
        case 'brainstorm':
          prompt = `Based on this note content, generate 3-5 focused, actionable ideas or related topics. Structure your response with clear headings and brief explanations for each suggestion:\n\nContent for brainstorming:\n"${content}"`;
          break;
        case 'todo':
          prompt = `Convert this content into a practical, actionable todo list. Extract clear tasks and use the format □ Task description. Group related tasks logically and focus on specific, measurable actions:\n\nContent to convert:\n"${content}"`;
          break;
        default:
          prompt = `Provide helpful suggestions or improvements for this note content. Focus on practical enhancements that would add value:\n\nContent to analyze:\n"${content}"`;
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
