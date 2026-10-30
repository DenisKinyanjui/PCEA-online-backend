const mongoose = require('mongoose');

const memberQuizStatsSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    currentStreak: { type: Number, default: 0, min: 0 },
    longestStreak: { type: Number, default: 0, min: 0 },
    lastAnswerDay: { type: String, default: '' },
    streakLostDay: { type: String, default: '' },
    lostPopupSeenDay: { type: String, default: '' },
    firstPopupDismissedUntil: { type: String, default: '' },
    reminderDismissedDay: { type: String, default: '' },
    version: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('MemberQuizStats', memberQuizStatsSchema);