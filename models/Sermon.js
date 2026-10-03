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

// Media uploaded to R2 is stored under the private R2 endpoint, which browsers can't read.
// For those, add a path (relative to the API base) to the streaming route in
// sermonController.streamSermonMedia. Public links (YouTube, Cloudinary, …) get null.
sermonSchema.set('toJSON', {
  transform: (doc, ret) => {
    const { r2KeyFromUrl } = require('../services/r2UploadService');
    ret.audioPath = r2KeyFromUrl(ret.audioUrl) ? `/sermons/${ret._id}/media/audio` : null;
    if (ret.video) {
      ret.video.path = ret.video.type === 'file' && r2KeyFromUrl(ret.video.url)
        ? `/sermons/${ret._id}/media/video`
        : null;
    }
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Sermon', sermonSchema);
