const mongoose = require('mongoose');

const quizAttemptSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    question: { type: mongoose.Schema.Types.ObjectId, ref: 'QuizQuestion', required: true },
    selectedIndex: { type: Number, required: true },
    correct: { type: Boolean, required: true },
    points: { type: Number, required: true, min: 0 },
    seasonPoints: { type: Number, required: true, min: 0, default: 0 },
    season: { type: mongoose.Schema.Types.ObjectId, ref: 'QuizSeason', default: null },
    answeredAt: { type: Date, required: true, default: Date.now },
    dayKey: { type: String, required: true },
  },
  { timestamps: true }
);

quizAttemptSchema.index({ user: 1, question: 1 }, { unique: true });
quizAttemptSchema.index({ season: 1, correct: 1, points: -1, answeredAt: 1 });
quizAttemptSchema.index({ user: 1, answeredAt: -1 });

module.exports = mongoose.model('QuizAttempt', quizAttemptSchema);