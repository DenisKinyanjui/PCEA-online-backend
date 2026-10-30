const mongoose = require('mongoose');
const Church = require('../models/Church');
const District = require('../models/District');
const Sermon = require('../models/Sermon');
const { generateChatReply } = require('../services/ai');

// Public visitor chat. Stateless: the browser keeps the conversation (in
// localStorage) and sends the recent turns with every request. Nothing is
// stored server-side.

const MAX_HISTORY = 10;
const MAX_MESSAGE_CHARS = 2000;
const MAX_SERMON_CONTEXT_CHARS = 12000;
const CHURCH_SLUG = 'pcea-emmanuel-thome-church';
const RELATED_SERMON_LIMIT = 3;
const RECENT_SERMON_LIMIT = 5;
const DISTRICT_QUESTION_PATTERN = /\bdistricts?\b|\belders?\b|\bdeacons?\b/i;
const DISTRICT_COUNT_PATTERN =
  /\bhow many\b.*\bdistricts?\b|\b(?:total|number|count)\s+of\s+districts?\b|\bdistrict\s+(?:count|number)\b/i;
const DISTRICT_LIST_PATTERN =
  /\b(?:list|name|show)\b.*\bdistricts?\b|\bwhat\s+(?:are|is)\s+(?:all\s+)?the\s+districts?\b/i;
const SERMON_QUESTION_PATTERN =
  /\bsermons?\b|\bpreach(?:ed|er|es|ing)?\b|\bpreaching\b|\bsermon archive\b|\bSunday(?:'s)?\b|\bchurch message\b/i;

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

function isDistrictQuestion(question) {
  return DISTRICT_QUESTION_PATTERN.test(question);
}

function isSermonQuestion(question) {
  return SERMON_QUESTION_PATTERN.test(question);
}

async function getActiveDistricts() {
  const church = await Church.findOne({ slug: CHURCH_SLUG, isActive: true }).select('_id').lean();
  if (!church) throw new Error(`Active church "${CHURCH_SLUG}" was not found`);

  return District.find({ church: church._id, isActive: true })
    .select('name elderName deacons')
    .sort({ name: 1 })
    .lean();
}

function formatLeadershipContext(districts) {
  if (!districts.length) {
    return 'Official active district records: No active districts are currently recorded for this church.';
  }

  return [
    `Official active district records for this church (${districts.length} districts). Use only these records for district questions; do not invent or infer names or counts.`,
    ...districts.map((district) => [
      `District: ${district.name}`,
      `District elder: ${district.elderName?.trim() || 'Not recorded'}`,
      `Deacons: ${district.deacons?.length ? district.deacons.join(', ') : 'None recorded'}`,
    ].join('\n')),
  ].join('\n\n');
}

function formatDistrictList(districts) {
  if (!districts.length) return 'There are no active districts currently recorded for this church.';
  return `There ${districts.length === 1 ? 'is' : 'are'} ${districts.length} active district${districts.length === 1 ? '' : 's'} in this church: ${districts.map((district) => district.name).join(', ')}.`;
}

function normalizeDistrictName(value) {
  return value
    .toLocaleLowerCase()
    .replace(/\bmount\b/g, 'mt')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function getDirectLeadershipReply(question, districts) {
  if (DISTRICT_COUNT_PATTERN.test(question)) return formatDistrictList(districts);
  if (DISTRICT_LIST_PATTERN.test(question)) return formatDistrictList(districts);
  if (!/\b(?:elder|deacon)\b/i.test(question)) return null;

  const normalizedQuestion = ` ${normalizeDistrictName(question)} `;
  const district = districts.find((entry) => {
    const normalizedName = normalizeDistrictName(entry.name);
    return normalizedName && normalizedQuestion.includes(` ${normalizedName} `);
  });
  if (!district) return null;

  const answers = [];
  if (/\belder\b/i.test(question)) {
    answers.push(
      district.elderName?.trim()
        ? `The district elder for ${district.name} is ${district.elderName.trim()}.`
        : `A district elder is not recorded for ${district.name}.`
    );
  }
  if (/\bdeacon\b/i.test(question)) {
    answers.push(
      district.deacons?.length
        ? `The deacons for ${district.name} are ${district.deacons.join(', ')}.`
        : `No deacons are recorded for ${district.name}.`
    );
  }
  return answers.join(' ');
}

// Sermon page chat: the full text of that sermon.
// Site-wide chat: sermons matching the question + the most recent sermons
// (so "what was last Sunday's sermon about?" works).
async function buildContext(sermonId, question) {
  const sections = [];
  if (sermonId && mongoose.isValidObjectId(sermonId)) {
    const sermon = await Sermon.findById(sermonId).lean();
    if (sermon) {
      sections.push(`The visitor is reading this sermon — questions like "this sermon" refer to it:\n\n${formatFullSermon(sermon)}`);
    }
  }

  if (isDistrictQuestion(question)) return sections.join('\n\n');

  if (!sections.length && isSermonQuestion(question)) {
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

    if (related.length) sections.push(`Sermons related to the question:\n${related.map(formatSermonSummary).join('\n')}`);
    if (recent.length) sections.push(`Most recent sermons:\n${recent.map(formatSermonSummary).join('\n')}`);
  }

  return sections.join('\n\n');
}

const sendChatMessage = async (req, res) => {
  const messages = sanitizeHistory(req.body?.messages);
  const last = messages[messages.length - 1];
  if (!last || last.role !== 'user') {
    return res.status(400).json({ success: false, message: 'Please enter a question.' });
  }

  try {
    if (isDistrictQuestion(last.content)) {
      const districts = await getActiveDistricts();
      const directReply = getDirectLeadershipReply(last.content, districts);
      if (directReply) {
        return res.json({ success: true, data: { reply: directReply } });
      }

      const reply = await generateChatReply(messages, formatLeadershipContext(districts));
      return res.json({ success: true, data: { reply } });
    }

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
