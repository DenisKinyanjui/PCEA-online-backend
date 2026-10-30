const test = require('node:test');
const assert = require('node:assert/strict');
const QuizAttempt = require('../models/QuizAttempt');
const MemberQuizStats = require('../models/MemberQuizStats');
const QuizSeason = require('../models/QuizSeason');
const { dayKey, shiftDay, streakTransition, streakPopup } = require('../utils/nairobiDay');
const { quizQuestionKey } = require('../utils/quizQuestionKey');
const { personalizedQuizOrder } = require('../utils/personalizedQuizOrder');

const emptyStats = {
  currentStreak: 0,
  longestStreak: 0,
  lastAnswerDay: '',
  streakLostDay: '',
  lostPopupSeenDay: '',
  firstPopupDismissedUntil: '',
  reminderDismissedDay: '',
  version: 0,
};

test('Nairobi calendar day changes at 21:00 UTC', () => {
  assert.equal(dayKey(new Date('2026-03-31T20:59:59.999Z')), '2026-03-31');
  assert.equal(dayKey(new Date('2026-03-31T21:00:00.000Z')), '2026-04-01');
  assert.equal(shiftDay('2026-04-01', -1), '2026-03-31');
});

test('first answer starts at one and a same-day answer does not increase streak', () => {
  const first = streakTransition(emptyStats, '2026-04-01');
  assert.equal(first.currentStreak, 1);
  assert.equal(first.longestStreak, 1);
  assert.strictEqual(streakTransition(first, '2026-04-01'), first);
});

test('consecutive answer days increase current and longest streaks', () => {
  const first = streakTransition(emptyStats, '2026-04-01');
  const second = streakTransition(first, '2026-04-02');
  assert.equal(second.currentStreak, 2);
  assert.equal(second.longestStreak, 2);
});

test('a missed full calendar day starts a new streak without erasing the record', () => {
  const previous = { ...emptyStats, currentStreak: 5, longestStreak: 8, lastAnswerDay: '2026-04-01' };
  const restarted = streakTransition(previous, '2026-04-03');
  assert.equal(restarted.currentStreak, 1);
  assert.equal(restarted.longestStreak, 8);
});

test('first popup dismissal lasts through the next three calendar days', () => {
  const dismissed = { ...emptyStats, firstPopupDismissedUntil: shiftDay('2026-04-01', 4) };
  assert.equal(streakPopup(dismissed, '2026-04-04'), null);
  assert.equal(streakPopup(dismissed, '2026-04-05'), 'first');
});

test('daily reminders and lost popups are each suppressible for the current day', () => {
  const reminder = { ...emptyStats, currentStreak: 2, lastAnswerDay: '2026-04-01' };
  assert.equal(streakPopup(reminder, '2026-04-02'), 'reminder');
  assert.equal(streakPopup({ ...reminder, reminderDismissedDay: '2026-04-02' }, '2026-04-02'), null);
  const lost = { ...emptyStats, lastAnswerDay: '2026-04-01', streakLostDay: '2026-04-02' };
  assert.equal(streakPopup(lost, '2026-04-02'), 'lost');
  assert.equal(streakPopup({ ...lost, lostPopupSeenDay: '2026-04-02' }, '2026-04-02'), null);
});

test('Mongo schemas persist streaks, prevent repeat question attempts, and isolate seasons', () => {
  assert.ok(MemberQuizStats.schema.path('currentStreak'));
  assert.ok(MemberQuizStats.schema.path('longestStreak'));
  assert.ok(MemberQuizStats.schema.path('firstPopupDismissedUntil'));
  assert.ok(QuizAttempt.schema.indexes().some(([fields, options]) => fields.user === 1 && fields.question === 1 && options.unique));
  assert.ok(QuizAttempt.schema.path('seasonPoints'));
  assert.equal(QuizSeason.schema.path('currentStreak'), undefined);
});

test('normalized prompt hashes ignore case and spacing for duplicate detection', () => {
  assert.equal(quizQuestionKey(' Who   built the Ark? '), quizQuestionKey('who built the ark?'));
});

test('question order is stable per member and independently shuffled for other members', () => {
  const questions = Array.from({ length: 50 }, (_, index) => ({ _id: `question-${index}` }));
  const memberAFirst = personalizedQuizOrder(questions, 'member-a').map((question) => question._id);
  const memberARefresh = personalizedQuizOrder(questions, 'member-a').map((question) => question._id);
  const memberBFirst = personalizedQuizOrder(questions, 'member-b').map((question) => question._id);
  assert.deepEqual(memberAFirst, memberARefresh);
  assert.notDeepEqual(memberAFirst, memberBFirst);
  assert.notEqual(memberAFirst[0], memberBFirst[0]);
});