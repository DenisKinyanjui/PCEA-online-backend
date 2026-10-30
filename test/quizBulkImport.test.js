const test = require('node:test');
const assert = require('node:assert/strict');
const { classifyBulkQuestions, toQuestionDocument } = require('../services/quizBulkImport');
const { quizQuestionKey } = require('../utils/quizQuestionKey');

const validQuestion = (overrides = {}) => ({
  prompt: 'Who built the ark?',
  options: ['Noah', 'Moses', 'David', 'Peter'],
  correctAnswer: 'A',
  difficulty: 'easy',
  category: 'Bible',
  explanation: 'Noah followed God’s instruction.',
  scriptureReference: 'Genesis 6',
  ...overrides,
});

test('validates required fields, options, answer, category, and difficulty on server side', () => {
  const [valid, invalid] = classifyBulkQuestions([
    validQuestion(),
    validQuestion({ prompt: '', options: ['only one'], correctAnswer: 'E', difficulty: 'expert', category: 'history', explanation: '' }),
  ]);
  assert.deepEqual(valid.errors, []);
  assert.equal(valid.correctIndex, 0);
  assert.ok(invalid.errors.length >= 5);
});

test('detects normalized duplicates in a batch and against persisted questions', () => {
  const existing = [{ prompt: 'The first question?', promptKey: quizQuestionKey('The first question?') }];
  const rows = classifyBulkQuestions([
    validQuestion({ prompt: 'The first question?' }),
    validQuestion({ prompt: '  WHO   BUILT THE ARK? ' }),
    validQuestion({ prompt: 'Who built the ark?' }),
  ], existing);
  assert.equal(rows[0].duplicate, true);
  assert.equal(Boolean(rows[1].duplicate), false);
  assert.equal(rows[2].duplicate, true);
});

test('invalid rows do not disqualify valid rows from import classification', () => {
  const rows = classifyBulkQuestions([
    validQuestion(),
    validQuestion({ prompt: 'Missing answers', options: ['A', 'B'], correctAnswer: 'Z' }),
    validQuestion({ prompt: 'A second valid question?' }),
  ]);
  assert.equal(rows.filter((row) => !row.errors.length && !row.duplicate).length, 2);
  assert.equal(rows.filter((row) => row.errors.length).length, 1);
});

test('maps a validated row to the existing question model shape', () => {
  const [row] = classifyBulkQuestions([validQuestion()]);
  const document = toQuestionDocument(row, 'admin-id');
  assert.equal(document.promptKey, quizQuestionKey(document.prompt));
  assert.equal(document.correctIndex, 0);
  assert.equal(document.createdBy, 'admin-id');
  assert.equal(document.archivedAt, null);
});