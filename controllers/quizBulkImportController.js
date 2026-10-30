const QuizQuestion = require('../models/QuizQuestion');
const { quizQuestionKey } = require('../utils/quizQuestionKey');
const { MAX_BULK_QUESTIONS, classifyBulkQuestions, toQuestionDocument } = require('../services/quizBulkImport');

const sendError = (res, status, message) => res.status(status).json({ success: false, message });

async function inspectRows(inputs) {
  const valid = inputs.map((input, index) => ({ input, index })).filter(({ input }) => {
    const row = classifyBulkQuestions([input])[0];
    return row.errors.length === 0;
  });
  const prompts = valid.map(({ input }) => String(input.prompt).trim());
  const keys = prompts.map(quizQuestionKey);
  const [matching, legacy] = valid.length ? await Promise.all([
    QuizQuestion.find({
      $or: [
        { promptKey: { $in: keys } },
        { prompt: { $in: prompts } },
      ],
    }).select('prompt promptKey').lean(),
    QuizQuestion.find({ promptKey: { $exists: false } }).select('prompt promptKey').lean(),
  ]) : [[], []];
  const existing = [...matching, ...legacy];
  const classified = classifyBulkQuestions(inputs, existing);
  for (const duplicate of classified.filter((row) => row.duplicate)) {
    if (duplicate.duplicateOf) continue;
    const found = existing.find((item) => (item.promptKey || quizQuestionKey(item.prompt)) === duplicate.promptKey);
    duplicate.duplicateOf = found?.prompt ?? duplicate.prompt;
  }
  return classified;
}

const previewBulkQuestions = async (req, res, next) => {
  try {
    if (!Array.isArray(req.body.questions)) return sendError(res, 400, 'Questions must be provided as an array');
    if (req.body.questions.length > MAX_BULK_QUESTIONS) return sendError(res, 413, `Import up to ${MAX_BULK_QUESTIONS} questions at a time`);
    const rows = await inspectRows(req.body.questions);
    res.json({
      success: true,
      total: rows.length,
      valid: rows.filter((row) => !row.errors.length && !row.duplicate).length,
      invalid: rows.filter((row) => row.errors.length).length,
      duplicates: rows.filter((row) => row.duplicate).length,
      data: rows.map((row) => ({ index: row.index, errors: row.errors, duplicate: Boolean(row.duplicate), duplicateOf: row.duplicateOf ?? null })),
    });
  } catch (error) { next(error); }
};

const importBulkQuestions = async (req, res, next) => {
  try {
    if (!Array.isArray(req.body.questions)) return sendError(res, 400, 'Questions must be provided as an array');
    if (req.body.questions.length > MAX_BULK_QUESTIONS) return sendError(res, 413, `Import up to ${MAX_BULK_QUESTIONS} questions at a time`);
    const rows = await inspectRows(req.body.questions);
    const duplicates = rows.filter((row) => row.duplicate).map((row) => ({ index: row.index, prompt: row.prompt, duplicateOf: row.duplicateOf }));
    const invalid = rows.filter((row) => row.errors.length).map((row) => ({ index: row.index, prompt: row.prompt, errors: row.errors }));
    const candidates = rows.filter((row) => !row.errors.length && !row.duplicate);
    const documents = candidates.map((row) => toQuestionDocument(row, req.user._id));
    let imported = 0;
    const raceDuplicates = [];
    const databaseErrors = [];

    if (documents.length) {
      try {
        const inserted = await QuizQuestion.insertMany(documents, { ordered: false });
        imported = inserted.length;
      } catch (error) {
        imported = error.insertedDocs?.length ?? error.result?.insertedCount ?? 0;
        for (const writeError of error.writeErrors || []) {
          const row = candidates[writeError.index];
          if (writeError.code === 11000) raceDuplicates.push({ index: row.index, prompt: row.prompt, duplicateOf: row.prompt });
          else databaseErrors.push({ index: row.index, prompt: row.prompt, errors: [writeError.errmsg || 'Database rejected this question'] });
        }
      }
    }

    const failures = invalid.length + duplicates.length + raceDuplicates.length + databaseErrors.length;
    res.status(imported === 0 && failures > 0 ? 207 : 200).json({
      success: true,
      total: rows.length,
      valid: candidates.length,
      invalid: invalid.length + databaseErrors.length,
      duplicates: duplicates.length + raceDuplicates.length,
      imported,
      errors: [...invalid, ...databaseErrors],
      duplicateRows: [...duplicates, ...raceDuplicates],
    });
  } catch (error) { next(error); }
};

module.exports = { previewBulkQuestions, importBulkQuestions };