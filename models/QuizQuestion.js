const mongoose = require('mongoose');

const quizQuestionSchema = new mongoose.Schema(
  {
    prompt: { type: String, required: true, trim: true, maxlength: 1200 },
    promptKey: { type: String, select: false },
    category: { type: String, default: 'Bible', enum: ['Bible', 'Moral'], trim: true },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], required: true },
    options: {
      type: [{ type: String, trim: true, maxlength: 300 }],
      validate: [(values) => values.length >= 2 && values.length <= 6, 'Provide 2 to 6 answer options'],
      required: true,
    },
    correctIndex: { type: Number, required: true, min: 0 },
    explanation: { type: String, required: true, trim: true, maxlength: 2000 },
    scriptureReference: { type: String, trim: true, maxlength: 120, default: '' },
    publishAt: { type: Date, default: Date.now },
    archivedAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

quizQuestionSchema.index({ archivedAt: 1, publishAt: 1, difficulty: 1 });
quizQuestionSchema.index({ promptKey: 1 }, { unique: true, sparse: true });
quizQuestionSchema.pre('validate', function () {
  if (this.isModified('prompt') && this.prompt) {
    this.promptKey = require('../utils/quizQuestionKey').quizQuestionKey(this.prompt);
  }
});
quizQuestionSchema.path('correctIndex').validate(function (value) {
  return value < this.options.length;
}, 'Correct answer must match an option');

module.exports = mongoose.model('QuizQuestion', quizQuestionSchema);