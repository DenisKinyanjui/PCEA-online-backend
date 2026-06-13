const mongoose = require('mongoose');

const sermonPointSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    verses: [{ type: String, trim: true }],
  },
  { _id: false }
);

const sermonContentSchema = new mongoose.Schema(
  {
    introduction: { type: String, default: '' },
    points: [sermonPointSchema],
    conclusion: { type: String, default: '' },
  },
  { _id: false }
);

const sermonVideoSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['youtube', 'file'], required: true },
    url: { type: String, required: true },
  },
  { _id: false }
);

const sermonSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Sermon title is required'],
      trim: true,
    },
    preacher: {
      type: String,
      required: [true, 'Preacher name is required'],
      trim: true,
    },
    date: {
      type: Date,
      required: [true, 'Sermon date is required'],
    },
    scriptureReferences: [{ type: String, trim: true }],
    content: {
      type: sermonContentSchema,
      default: () => ({ introduction: '', points: [], conclusion: '' }),
    },
    summary: {
      type: String,
      trim: true,
      default: '',
    },
    audioUrl: {
      type: String,
      trim: true,
      default: '',
    },
    video: {
      type: sermonVideoSchema,
      default: null,
    },
    attachments: [
      {
        name: { type: String, trim: true },
        url: { type: String, trim: true },
        fileType: { type: String, trim: true },
      },
    ],
    church: {
      type: String,
      default: 'P.C.E.A Emmanuel Thome Church',
    },
  },
  { timestamps: true }
);

// Text index for full-text search on title, preacher, and transcript content
sermonSchema.index({ title: 'text', preacher: 'text', 'content.introduction': 'text', 'content.conclusion': 'text', summary: 'text' });

module.exports = mongoose.model('Sermon', sermonSchema);
