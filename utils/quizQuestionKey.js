const crypto = require('crypto');

function normalizeQuestionPrompt(prompt) {
  return String(prompt || '').normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
}

function quizQuestionKey(prompt) {
  const normalized = normalizeQuestionPrompt(prompt);
  return normalized ? crypto.createHash('sha256').update(normalized).digest('hex') : '';
}

module.exports = { normalizeQuestionPrompt, quizQuestionKey };