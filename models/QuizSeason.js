const mongoose = require('mongoose');

const quizSeasonSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    status: { type: String, enum: ['scheduled', 'active', 'review', 'finalized'], default: 'scheduled' },
    rewards: [{ place: { type: Number, min: 1, max: 3 }, description: { type: String, trim: true, maxlength: 300 } }],
    winners: [{ user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, name: String, points: Number, place: Number, reward: String }],
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    finalizedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

quizSeasonSchema.index({ startsAt: 1, endsAt: 1 });

module.exports = mongoose.model('QuizSeason', quizSeasonSchema);