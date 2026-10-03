const mongoose = require('mongoose');
const Sermon = require('../models/Sermon');
const { generateChatReply } = require('../services/ai');

// Public visitor chat. Stateless: the browser keeps the conversation (in
// localStorage) and sends the recent turns with every request. Nothing is
// stored server-side.

const MAX_HISTORY = 10;
const MAX_MESSAGE_CHARS = 2000;
const MAX_SERMON_CONTEXT_CHARS = 12000;
const RELATED_SERMON_LIMIT = 3;
const RECENT_SERMON_LIMIT = 5;

const formatDate = (date) => (date ? new Date(date).toISOString().slice(0, 10) : 'unknown date');

// Keeps only well-formed user/assistant turns, trims them, and caps both the
// number of turns and their length so a client can't inflate the prompt.
function sanitizeHistory(messages) {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter(
      (m) =>
        m &&
        (m.role === 'user' || m.role === 'assistant') &&
        typeof m.content === 'string' &&
        m.content.trim()
    )
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role, content: m.content.trim().slice(0, MAX_MESSAGE_CHARS) }));
}

function formatSermonSummary(s) {
  const lines = [`- "${s.title}" by ${s.preacher} (${formatDate(s.date)})`];
  if (s.scriptureReferences?.length) lines.push(`  Scripture: ${s.scriptureReferences.join(', ')}`);
  if (s.summary) lines.push(`  Summary: ${s.summary}`);
  return lines.join('\n');
}

function formatFullSermon(s) {
  const parts = [
    `Title: ${s.title}`,
    `Preacher: ${s.preacher}`,
    `Date: ${formatDate(s.date)}`,
  ];
  if (s.scriptureReferences?.length) parts.push(`Scripture: ${s.scriptureReferences.join(', ')}`);
  if (s.summary) parts.push(`Summary: ${s.summary}`);
  if (s.content?.introduction) parts.push(`Introduction:\n${s.content.introduction}`);
  (s.content?.points || []).forEach((p, i) => {
    const verses = p.verses?.length ? ` (${p.verses.join(', ')})` : '';
    parts.push(`Point ${i + 1}: ${p.title}${verses}\n${p.description}`);
  });
  if (s.content?.conclusion) parts.push(`Conclusion:\n${s.content.conclusion}`);
  return parts.join('\n\n').slice(0, MAX_SERMON_CONTEXT_CHARS);
}

// Sermon page chat: the full text of that sermon.
// Site-wide chat: sermons matching the question + the most recent sermons
// (so "what was last Sunday's sermon about?" works).
async function buildContext(sermonId, question) {
  if (sermonId && mongoose.isValidObjectId(sermonId)) {
    const sermon = await Sermon.findById(sermonId).lean();
    if (sermon) {
      return `The visitor is reading this sermon — questions like "this sermon" refer to it:\n\n${formatFullSermon(sermon)}`;
    }
  }

  const summaryFields = 'title preacher date summary scriptureReferences';
  const [related, recent] = await Promise.all([
    Sermon.find({ $text: { $search: question } }, { score: { $meta: 'textScore' } })
      .sort({ score: { $meta: 'textScore' } })
      .limit(RELATED_SERMON_LIMIT)
      .select(summaryFields)
      .lean()
      .catch(() => []),
    Sermon.find().sort({ date: -1 }).limit(RECENT_SERMON_LIMIT).select(summaryFields).lean(),
  ]);

  const sections = [];
  if (related.length) sections.push(`Sermons related to the question:\n${related.map(formatSermonSummary).join('\n')}`);
  if (recent.length) sections.push(`Most recent sermons:\n${recent.map(formatSermonSummary).join('\n')}`);
  return sections.join('\n\n');
}

const sendChatMessage = async (req, res) => {
  const messages = sanitizeHistory(req.body?.messages);
  const last = messages[messages.length - 1];
  if (!last || last.role !== 'user') {
    return res.status(400).json({ success: false, message: 'Please enter a question.' });
  }

  try {
    const context = await buildContext(req.body?.sermonId, last.content);
    const reply = await generateChatReply(messages, context);
    res.json({ success: true, data: { reply } });
  } catch (error) {
    // Public endpoint: log the real cause, but don't leak provider/config
    // details (e.g. "MIMO_API_KEY is not set") to visitors.
    console.error('[chat] failed to generate reply:', error.message);
    res.status(503).json({
      success: false,
      message: 'The assistant is unavailable right now. Please try again in a moment.',
    });
  }
};

module.exports = { sendChatMessage };
