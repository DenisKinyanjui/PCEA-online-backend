const mongoose = require('mongoose');

const churchSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Church name is required'],
      trim: true,
      unique: true,
    },
    slug: {
      type: String,
      required: [true, 'Slug is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9-]+$/, 'Slug may only contain lowercase letters, numbers and hyphens'],
    },
    tagline: { type: String, trim: true, default: '' },
    description: { type: String, trim: true, default: '' },
    address: { type: String, trim: true, default: '' },
    contactEmail: { type: String, trim: true, default: '' },
    contactPhone: { type: String, trim: true, default: '' },
    logoUrl: { type: String, trim: true, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Explicit index on slug for fast by-slug lookups
churchSchema.index({ slug: 1 });

module.exports = mongoose.model('Church', churchSchema);
