const mongoose = require('mongoose');

// "Message to the Youth": the short word a pastor or guest minister gives the
// youth before praying for them during the Sunday service.
const youthMessageSchema = new mongoose.Schema(
  {
    minister: {
      type: String,
      required: [true, 'Minister name is required'],
      trim: true,
      maxlength: [120, 'Minister name must be 120 characters or fewer'],
    },
    message: {
      type: String,
      required: [true, 'Message is required'],
      trim: true,
      maxlength: [10000, 'Message must be 10000 characters or fewer'],
    },
    // Optional, free text, e.g. "Jeremiah 29:11" or "1 Timothy 4:12 — Let no one despise your youth…"
    bibleVerse: {
      type: String,
      trim: true,
      default: '',
      maxlength: [500, 'Bible verse must be 500 characters or fewer'],
    },
    // The service date. Stored at 12:00 UTC so it reads as the same calendar day in any timezone.
    date: {
      type: Date,
      required: [true, 'Date is required'],
    },
    church: {
      type: String,
      trim: true,
      default: 'P.C.E.A Emmanuel Thome Church',
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

youthMessageSchema.index({ church: 1, date: -1 });

youthMessageSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('YouthMessage', youthMessageSchema);
