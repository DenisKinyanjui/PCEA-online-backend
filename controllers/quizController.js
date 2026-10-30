const QuizQuestion = require('../models/QuizQuestion');
const QuizSeason = require('../models/QuizSeason');
const QuizAttempt = require('../models/QuizAttempt');
const MemberQuizStats = require('../models/MemberQuizStats');
const { dayKey, shiftDay, streakTransition, streakPopup } = require('../utils/nairobiDay');
const { personalizedQuizOrder } = require('../utils/personalizedQuizOrder');

const POINTS = { easy: 10, medium: 20, hard: 30 };
const sendError = (res, status, message) => res.status(status).json({ success: false, message });

async function getStats(userId) {
  try {
    return await MemberQuizStats.findOneAndUpdate(
      { user: userId },
      { $setOnInsert: { user: userId } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
  } catch (error) {
    if (error.code !== 11000) throw error;
    return MemberQuizStats.findOne({ user: userId });
  }
}

async function refreshStreakState(stats, today) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const missed = Boolean(stats.lastAnswerDay && stats.lastAnswerDay < shiftDay(today, -1) && stats.currentStreak > 0);
    if (!missed) return stats;
    const updated = await MemberQuizStats.findOneAndUpdate(
      { user: stats.user, version: stats.version },
      { $set: { currentStreak: 0, streakLostDay: today }, $inc: { version: 1 } },
      { new: true }
    );
    if (updated) return updated;
    stats = await getStats(stats.user);
  }
  throw new Error('Could not safely refresh member streak');
}

async function recordStreakDay(userId, today) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const stats = await getStats(userId);
    if (stats.lastAnswerDay === today) return stats;
    const next = streakTransition(stats, today);
    const updated = await MemberQuizStats.findOneAndUpdate(
      { user: userId, version: stats.version },
      {
        $set: {
          currentStreak: next.currentStreak,
          longestStreak: next.longestStreak,
          lastAnswerDay: next.lastAnswerDay,
          streakLostDay: next.streakLostDay,
          version: next.version,
        },
      },
      { new: true }
    );
    if (updated) return updated;
  }
  throw new Error('Could not safely record member streak');
}

async function getSeason(now = new Date()) {
  return QuizSeason.findOne({ startsAt: { $lte: now }, endsAt: { $gt: now }, status: { $ne: 'finalized' } })
    .sort({ startsAt: -1 });
}

async function aggregateLeaderboard(seasonId) {
  return QuizAttempt.aggregate([
    { $match: { season: seasonId, seasonPoints: { $gt: 0 } } },
    { $group: { _id: '$user', points: { $sum: '$seasonPoints' }, correctAnswers: { $sum: 1 } } },
    { $sort: { points: -1, correctAnswers: -1, _id: 1 } },
    { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'member' } },
    { $unwind: '$member' },
    { $project: { _id: 0, userId: '$_id', name: '$member.name', points: 1, correctAnswers: 1 } },
  ]);
}

async function aggregateAllTimeLeaderboard() {
  return QuizAttempt.aggregate([
    { $match: { points: { $gt: 0 } } },
    { $group: { _id: '$user', points: { $sum: '$points' }, correctAnswers: { $sum: 1 } } },
    { $sort: { points: -1, correctAnswers: -1, _id: 1 } },
    { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'member' } },
    { $unwind: '$member' },
    { $project: { _id: 0, userId: '$_id', name: '$member.name', points: 1, correctAnswers: 1 } },
  ]);
}

const getQuestions = async (req, res, next) => {
  try {
    const attempted = await QuizAttempt.find({ user: req.user._id }).distinct('question');
    const questions = await QuizQuestion.find({ archivedAt: null, publishAt: { $lte: new Date() }, _id: { $nin: attempted } })
      .select('-correctIndex -createdBy -__v')
      .lean();
    res.json({ success: true, data: personalizedQuizOrder(questions, req.user._id).slice(0, 40) });
  } catch (error) { next(error); }
};

const getPreviewQuestions = async (req, res, next) => {
  try {
    const questions = await QuizQuestion.find({ archivedAt: null, publishAt: { $lte: new Date() } })
      .select('_id prompt category difficulty options scriptureReference')
      .sort({ publishAt: -1, _id: 1 })
      .limit(40)
      .lean();
    res.json({ success: true, data: questions });
  } catch (error) { next(error); }
};

const submitAnswer = async (req, res, next) => {
  try {
    const { questionId, selectedIndex } = req.body;
    if (!/^[a-f\d]{24}$/i.test(String(questionId || '')) || !Number.isInteger(selectedIndex)) {
      return sendError(res, 400, 'Choose a valid answer for a quiz question');
    }
    const question = await QuizQuestion.findOne({ _id: questionId, archivedAt: null, publishAt: { $lte: new Date() } });
    if (!question) return sendError(res, 404, 'Question is unavailable');
    if (selectedIndex < 0 || selectedIndex >= question.options.length) return sendError(res, 400, 'Answer option is invalid');

    const now = new Date();
    const today = dayKey(now);
    const season = await getSeason(now);
    const correct = selectedIndex === question.correctIndex;
    const points = correct ? POINTS[question.difficulty] : 0;
    let attempt;
    try {
      attempt = await QuizAttempt.create({
        user: req.user._id,
        question: question._id,
        selectedIndex,
        correct,
        points,
        seasonPoints: season ? points : 0,
        season: season?._id ?? null,
        answeredAt: now,
        dayKey: today,
      });
    } catch (error) {
      if (error.code === 11000) return sendError(res, 409, 'You have already answered this question');
      throw error;
    }

    let stats = await getStats(req.user._id);
    stats = await refreshStreakState(stats, today);
    stats = await recordStreakDay(req.user._id, today);

    res.status(201).json({
      success: true,
      data: {
        correct,
        points,
        selectedIndex,
        correctIndex: question.correctIndex,
        explanation: question.explanation,
        scriptureReference: question.scriptureReference,
        streak: stats.currentStreak,
        longestStreak: stats.longestStreak,
        seasonPoints: season ? points : 0,
        answeredAt: attempt.answeredAt,
      },
    });
  } catch (error) { next(error); }
};

const getMemberSummary = async (req, res, next) => {
  try {
    const now = new Date();
    const today = dayKey(now);
    let stats = await getStats(req.user._id);
    stats = await refreshStreakState(stats, today);
    const answeredToday = stats.lastAnswerDay === today;
    const popup = streakPopup(stats, today);
    if (popup === 'lost') {
      await MemberQuizStats.updateOne({ user: stats.user }, { $set: { lostPopupSeenDay: today }, $inc: { version: 1 } });
    }
    const season = await getSeason(now);
    const [allTime, seasonBoard, attempts, availableCount] = await Promise.all([
      QuizAttempt.aggregate([{ $match: { user: req.user._id } }, { $group: { _id: null, points: { $sum: '$points' }, answered: { $sum: 1 }, correct: { $sum: { $cond: ['$correct', 1, 0] } } } }]),
      season ? aggregateLeaderboard(season._id) : Promise.resolve([]),
      QuizAttempt.find({ user: req.user._id }).sort({ answeredAt: -1 }).limit(12).populate('question', 'prompt difficulty scriptureReference'),
      QuizQuestion.countDocuments({ archivedAt: null, publishAt: { $lte: now }, _id: { $nin: await QuizAttempt.find({ user: req.user._id }).distinct('question') } }),
    ]);
    const rank = seasonBoard.findIndex((entry) => String(entry.userId) === String(req.user._id));
    res.json({
      success: true,
      data: {
        currentStreak: stats.currentStreak,
        longestStreak: stats.longestStreak,
        answeredToday,
        answeredCount: allTime[0]?.answered ?? 0,
        correctCount: allTime[0]?.correct ?? 0,
        allTimePoints: allTime[0]?.points ?? 0,
        availableQuestions: availableCount,
        season: season ? { _id: season._id, name: season.name, startsAt: season.startsAt, endsAt: season.endsAt, points: seasonBoard[rank]?.points ?? 0, rank: rank < 0 ? null : rank + 1 } : null,
        popup,
        attempts: attempts.map((attempt) => ({
          answeredAt: attempt.answeredAt,
          correct: attempt.correct,
          points: attempt.points,
          question: attempt.question ? { prompt: attempt.question.prompt, difficulty: attempt.question.difficulty, scriptureReference: attempt.question.scriptureReference } : null,
        })),
      },
    });
  } catch (error) { next(error); }
};

const getLeaderboard = async (req, res, next) => {
  try {
    const seasons = await QuizSeason.find().select('name startsAt endsAt status').sort({ startsAt: -1 });
    const allTime = req.query.scope === 'alltime';
    const season = allTime ? null : req.query.seasonId ? await QuizSeason.findById(req.query.seasonId) : await getSeason();
    const board = allTime ? await aggregateAllTimeLeaderboard() : season ? await aggregateLeaderboard(season._id) : [];
    res.json({ success: true, season: season ? { _id: season._id, name: season.name, startsAt: season.startsAt, endsAt: season.endsAt, status: season.status } : null, scope: allTime ? 'alltime' : 'season', seasons, data: board.map((entry, index) => ({ rank: index + 1, ...entry, isCurrentUser: String(entry.userId) === String(req.user._id) })) });
  } catch (error) { next(error); }
};

const getPublicLeaderboard = async (req, res, next) => {
  try {
    const season = await getSeason();
    const board = season ? await aggregateLeaderboard(season._id) : [];
    res.json({
      success: true,
      season: season ? { name: season.name } : null,
      data: board.slice(0, 10).map(({ name, points, correctAnswers }, index) => ({
        rank: index + 1,
        name,
        points,
        correctAnswers,
      })),
    });
  } catch (error) { next(error); }
};

const dismissStreakPopup = async (req, res, next) => {
  try {
    const { type } = req.body;
    const today = dayKey();
    const stats = await getStats(req.user._id);
    const update = type === 'first'
      ? { firstPopupDismissedUntil: shiftDay(today, 4) }
      : type === 'reminder'
        ? { reminderDismissedDay: today }
        : type === 'lost'
          ? { lostPopupSeenDay: today }
          : null;
    if (!update) return sendError(res, 400, 'Invalid popup type');
    await MemberQuizStats.updateOne({ user: stats.user }, { $set: update, $inc: { version: 1 } });
    res.json({ success: true });
  } catch (error) { next(error); }
};

const getManagedQuestions = async (req, res, next) => {
  try {
    const questions = await QuizQuestion.find().sort({ createdAt: -1 });
    const attemptCounts = await QuizAttempt.aggregate([{ $group: { _id: '$question', count: { $sum: 1 } } }]);
    const counts = new Map(attemptCounts.map((item) => [String(item._id), item.count]));
    res.json({ success: true, data: questions.map((question) => ({ ...question.toObject(), attempts: counts.get(String(question._id)) ?? 0 })) });
  } catch (error) { next(error); }
};

function validateQuestion(body) {
  const errors = [];
  const prompt = String(body.prompt || '').trim();
  const options = Array.isArray(body.options) ? body.options.map((option) => String(option).trim()).filter(Boolean) : [];
  const correctIndex = Number(body.correctIndex);
  if (!prompt) errors.push('Question text is required');
  if (options.length < 2 || options.length > 6) errors.push('Provide 2 to 6 answer options');
  if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length) errors.push('Select a valid correct answer');
  if (!['easy', 'medium', 'hard'].includes(body.difficulty)) errors.push('Choose a valid difficulty');
  if (!String(body.explanation || '').trim()) errors.push('An explanation is required');
  const publishAt = body.publishAt ? new Date(body.publishAt) : new Date();
  if (Number.isNaN(publishAt.getTime())) errors.push('Publish date is invalid');
  if (body.category && !['Bible', 'Moral'].includes(body.category)) errors.push('Choose a valid category');
  return { errors, values: { prompt, options, correctIndex, difficulty: body.difficulty, explanation: String(body.explanation || '').trim(), scriptureReference: String(body.scriptureReference || '').trim(), category: body.category || 'Bible', publishAt } };
}

const createQuestion = async (req, res, next) => {
  try {
    const { errors, values } = validateQuestion(req.body);
    if (errors.length) return sendError(res, 400, errors[0]);
    const question = await QuizQuestion.create({ ...values, createdBy: req.user._id });
    res.status(201).json({ success: true, data: question });
  } catch (error) { next(error); }
};

const updateQuestion = async (req, res, next) => {
  try {
    const question = await QuizQuestion.findById(req.params.id);
    if (!question) return sendError(res, 404, 'Question not found');
    if (await QuizAttempt.exists({ question: question._id })) return sendError(res, 409, 'Questions with answer history cannot be edited; archive them and create a replacement');
    const { errors, values } = validateQuestion(req.body);
    if (errors.length) return sendError(res, 400, errors[0]);
    Object.assign(question, values);
    await question.save();
    res.json({ success: true, data: question });
  } catch (error) { next(error); }
};

const archiveQuestion = async (req, res, next) => {
  try {
    const question = await QuizQuestion.findByIdAndUpdate(req.params.id, { archivedAt: new Date() }, { new: true });
    if (!question) return sendError(res, 404, 'Question not found');
    res.json({ success: true, data: question });
  } catch (error) { next(error); }
};

const getSeasons = async (req, res, next) => {
  try {
    const seasons = await QuizSeason.find().sort({ startsAt: -1 });
    const data = await Promise.all(seasons.map(async (season) => ({ ...season.toObject(), leaderboard: await aggregateLeaderboard(season._id) })));
    res.json({ success: true, data });
  } catch (error) { next(error); }
};

function validateSeason(body) {
  const startsAt = new Date(body.startsAt);
  const endsAt = new Date(body.endsAt);
  if (!String(body.name || '').trim()) return { error: 'Season name is required' };
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || startsAt >= endsAt) return { error: 'Season dates must be valid and the end must follow the start' };
  const rewards = Array.isArray(body.rewards) ? body.rewards.slice(0, 3).map((reward, index) => ({ place: index + 1, description: String(reward.description || '').trim() })) : [];
  return { values: { name: String(body.name).trim(), startsAt, endsAt, rewards } };
}

const createSeason = async (req, res, next) => {
  try {
    const { error, values } = validateSeason(req.body);
    if (error) return sendError(res, 400, error);
    const overlapping = await QuizSeason.exists({ status: { $ne: 'finalized' }, startsAt: { $lt: values.endsAt }, endsAt: { $gt: values.startsAt } });
    if (overlapping) return sendError(res, 409, 'Season dates overlap an existing competition');
    values.status = values.startsAt > new Date() ? 'scheduled' : values.endsAt > new Date() ? 'active' : 'review';
    const season = await QuizSeason.create(values);
    res.status(201).json({ success: true, data: season });
  } catch (error) { next(error); }
};

const updateSeason = async (req, res, next) => {
  try {
    const season = await QuizSeason.findById(req.params.id);
    if (!season) return sendError(res, 404, 'Season not found');
    if (season.status !== 'scheduled' || season.startsAt <= new Date()) return sendError(res, 409, 'Only future scheduled seasons can be changed');
    const { error, values } = validateSeason(req.body);
    if (error) return sendError(res, 400, error);
    const overlap = await QuizSeason.exists({ _id: { $ne: season._id }, status: { $ne: 'finalized' }, startsAt: { $lt: values.endsAt }, endsAt: { $gt: values.startsAt } });
    if (overlap) return sendError(res, 409, 'Season dates overlap an existing competition');
    Object.assign(season, values);
    season.status = season.startsAt > new Date() ? 'scheduled' : season.endsAt > new Date() ? 'active' : 'review';
    await season.save();
    res.json({ success: true, data: season });
  } catch (error) { next(error); }
};

const reviewSeason = async (req, res, next) => {
  try {
    const season = await QuizSeason.findById(req.params.id);
    if (!season) return sendError(res, 404, 'Season not found');
    if (season.endsAt > new Date()) return sendError(res, 409, 'Season rankings are available for review after the competition ends');
    const board = await aggregateLeaderboard(season._id);
    season.status = 'review';
    season.winners = board.slice(0, 3).map((entry, index) => ({ user: entry.userId, name: entry.name, points: entry.points, place: index + 1, reward: season.rewards.find((reward) => reward.place === index + 1)?.description || '' }));
    await season.save();
    res.json({ success: true, data: season });
  } catch (error) { next(error); }
};

const finalizeSeason = async (req, res, next) => {
  try {
    const season = await QuizSeason.findById(req.params.id);
    if (!season) return sendError(res, 404, 'Season not found');
    if (season.status !== 'review') return sendError(res, 409, 'Review the ended season before confirming results');
    const reviewedIds = new Set(season.winners.map((winner) => String(winner.user)));
    const winners = Array.isArray(req.body.winners) ? req.body.winners : [];
    const confirmedIds = new Set(winners.map((winner) => String(winner.user)));
    if (winners.length !== reviewedIds.size || confirmedIds.size !== winners.length || winners.some((winner) => !reviewedIds.has(String(winner.user)))) {
      return sendError(res, 400, 'Confirm each reviewed winner exactly once');
    }
    season.winners = winners.map((winner) => {
      const existing = season.winners.find((item) => String(item.user) === String(winner.user));
      return { ...existing.toObject(), reward: String(winner.reward || '').trim() };
    });
    season.status = 'finalized';
    season.reviewedBy = req.user._id;
    season.finalizedAt = new Date();
    await season.save();
    res.json({ success: true, data: season });
  } catch (error) { next(error); }
};

module.exports = {
  getQuestions,
  getPreviewQuestions,
  submitAnswer,
  getMemberSummary,
  getLeaderboard,
  getPublicLeaderboard,
  dismissStreakPopup,
  getManagedQuestions,
  createQuestion,
  updateQuestion,
  archiveQuestion,
  getSeasons,
  createSeason,
  updateSeason,
  reviewSeason,
  finalizeSeason,
};