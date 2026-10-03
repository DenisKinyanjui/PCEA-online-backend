// AI provider adapter.
//
// The rest of the app (aiSermonPipeline.js, chatController.js) only calls
// the functions exported from this file — never a specific provider's
// service module directly. To add another provider (OpenAI, Claude, Gemini, ...):
//   1. Add services/ai/<provider>Service.js implementing the same
//      interface: transcribeMedia(buffer, filename, mimeType),
//      generateSermonStructure(text, userPrompt) and
//      generateChatReply(messages, context).
//   2. Register it in the `providers` map below.
//   3. Set AI_PROVIDER=<provider> in the environment.

const mimoService = require('./mimoService');

const providers = {
  mimo: mimoService,
};

function getProvider() {
  const name = process.env.AI_PROVIDER || 'mimo';
  const provider = providers[name];
  if (!provider) {
    throw new Error(`Unknown AI_PROVIDER "${name}". Available: ${Object.keys(providers).join(', ')}`);
  }
  return provider;
}

module.exports = {
  transcribeMedia: (...args) => getProvider().transcribeMedia(...args),
  generateSermonStructure: (...args) => getProvider().generateSermonStructure(...args),
  generateChatReply: (...args) => getProvider().generateChatReply(...args),
};
