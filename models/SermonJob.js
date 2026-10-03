const mongoose = require('mongoose');

const STAGE_STATUS = ['pending', 'processing', 'done', 'failed'];

const stageSchema = new mongoose.Schema(
  {
    status: { type: String, enum: STAGE_STATUS, default: 'pending' },
    error: { type: String, default: '' },
  },
  { _id: false }
);

const aiSectionSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['introduction', 'point', 'conclusion'], required: true },
    title: { type: String, default: '' },
    content: { type: String, default: '' },
    scripture: [{ type: String, trim: true }],
  },
  { _id: false }
);

const sermonJobSchema = new mongoose.Schema(
  {
    sourceFileUrl: { type: String, required: true },
    sourceFileKey: { type: String, default: '' },  // R2 object key for internal download
    sourceFilePath: { type: String, default: '' },  // kept for backwards-compat; no longer used
    sourceFileType: { type: String, enum: ['audio', 'video', 'document'], required: true },
    sourceMimeType: { type: String, default: '' },
    originalFileName: { type: String, default: '' },
    userPrompt: { type: String, default: '' },
    church: { type: String, default: '' },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    status: {
      type: String,
      enum: ['uploaded', 'processing', 'completed', 'failed'],
      default: 'uploaded',
    },

    stages: {
      transcribing: { type: stageSchema, default: () => ({}) },
      analyzing: { type: stageSchema, default: () => ({}) },
      structuring: { type: stageSchema, default: () => ({}) },
      saving: { type: stageSchema, default: () => ({}) },
    },

    rawTranscript: { type: String, default: '' },
    errorMessage: { type: String, default: '' },

    aiResult: {
      titleSuggestions: [{ type: String }],
      summary: { type: String, default: '' },
      sections: [aiSectionSchema],
      keyThemes: [{ type: String }],
      keyVerses: [{ type: String }],
      tags: [{ type: String }],
      seriesSuggestion: { type: String, default: '' },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SermonJob', sermonJobSchema);
