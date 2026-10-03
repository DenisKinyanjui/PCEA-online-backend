const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [150, 'Title must be 150 characters or fewer'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      maxlength: [5000, 'Description must be 5000 characters or fewer'],
    },
    // Optional poster, stored in R2. Served through GET /api/announcements/:id/image
    // because the R2 S3 endpoint is not publicly readable.
    imageKey: { type: String, default: '' },
    imageMimeType: { type: String, default: '' },
    // Announcements are hidden from the public site once this moment has passed.
    expiresAt: {
      type: Date,
      required: [true, 'Expiry date is required'],
    },
    // Scoped by church name, like sermons (single-church MVP default).
    church: {
      type: String,
      trim: true,
      default: 'P.C.E.A Emmanuel Thome Church',
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

announcementSchema.index({ church: 1, expiresAt: 1 });

// Never expose the raw storage key; give clients a path relative to the API base instead.
announcementSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.imagePath = ret.imageKey
      ? `/announcements/${ret._id}/image?v=${new Date(ret.updatedAt).getTime()}`
      : null;
    delete ret.imageKey;
    delete ret.imageMimeType;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Announcement', announcementSchema);
