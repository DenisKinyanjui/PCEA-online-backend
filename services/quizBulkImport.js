const { normalizeQuestionPrompt, quizQuestionKey } = require('../utils/quizQuestionKey');

const MAX_BULK_QUESTIONS = 200;

function validateBulkQuestion(input, index) {
  const errors = [];
  const prompt = String(input.prompt || '').trim();
  const options = Array.isArray(input.options)
    ? input.options.map((option) => String(option || '').trim())
    : ['A', 'B', 'C', 'D'].map((letter) => String(input[`option${letter}`] || '').trim());
  const difficulty = String(input.difficulty || '').trim().toLowerCase();
  const categoryValue = String(input.category || '').trim().toLowerCase();
  const explanation = String(input.explanation || '').trim();
  const scriptureReference = String(input.scriptureReference || input.scripture || '').trim();
  const publishAt = input.publishAt ? new Date(input.publishAt) : new Date();
  const rawAnswer = input.correctAnswer ?? input.correctIndex ?? '';
  let correctIndex = Number.isInteger(rawAnswer) ? rawAnswer : -1;

  if (typeof rawAnswer === 'string') {
    const answerLetter = rawAnswer.trim().toUpperCase().match(/^(?:OPTION\s*)?([A-D])(?:[.)])?$/);
    if (answerLetter) correctIndex = answerLetter[1].charCodeAt(0) - 65;
    else correctIndex = options.findIndex((option) => option.toLowerCase() === rawAnswer.trim().toLowerCase());
  }

  if (!prompt) errors.push('Question text is required');
  if (prompt.length > 1200) errors.push('Question text must be 1200 characters or fewer');
  if (options.length !== 4 || options.some((option) => !option)) errors.push('Exactly four non-empty options A-D are required');
  if (options.some((option) => option.length > 300)) errors.push('Each option must be 300 characters or fewer');
  if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length) errors.push('Correct answer must be A, B, C, D, or an exact option');
  if (!['easy', 'medium', 'hard'].includes(difficulty)) errors.push('Difficulty must be easy, medium, or hard');
  if (!['bible', 'moral'].includes(categoryValue)) errors.push('Category must be Bible or Moral');
  if (!explanation) errors.push('Explanation is required');
  if (explanation.length > 2000) errors.push('Explanation must be 2000 characters or fewer');
  if (scriptureReference.length > 120) errors.push('Scripture reference must be 120 characters or fewer');
  if (Number.isNaN(publishAt.getTime())) errors.push('Publish date is invalid');

  return {
    index,
    errors,
    prompt,
    options,
    correctIndex,
    difficulty,
    category: categoryValue === 'moral' ? 'Moral' : 'Bible',
    explanation,
    scriptureReference,
    publishAt,
    promptKey: quizQuestionKey(prompt),
  };
}

function classifyBulkQuestions(inputs, existingQuestions = []) {
  const rows = inputs.map((input, index) => validateBulkQuestion(input, index));
  const existingByKey = new Map(existingQuestions.map((question) => [
    question.promptKey || quizQuestionKey(question.prompt),
    question.prompt,
  ]));
  const seenInBatch = new Map();

  for (const row of rows) {
    if (row.errors.length) continue;
    const normalized = normalizeQuestionPrompt(row.prompt);
    const duplicatePrompt = existingByKey.get(row.promptKey) || seenInBatch.get(normalized);
    if (duplicatePrompt) {
      row.duplicate = true;
      row.duplicateOf = duplicatePrompt;
    } else {
      seenInBatch.set(normalized, row.prompt);
    }
  }
  return rows;
}

function toQuestionDocument(row, createdBy) {
  return {
    prompt: row.prompt,
    promptKey: row.promptKey,
    category: row.category,
    difficulty: row.difficulty,
    options: row.options,
    correctIndex: row.correctIndex,
    explanation: row.explanation,
    scriptureReference: row.scriptureReference,
    publishAt: row.publishAt,
    archivedAt: null,
    createdBy,
  };
}

module.exports = { MAX_BULK_QUESTIONS, validateBulkQuestion, classifyBulkQuestions, toQuestionDocument };