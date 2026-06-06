const mongoose = require('mongoose');

const seriesSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Series name is required'],
      trim: true,
      unique: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    church: {
      type: String,
      default: 'P.C.E.A Emmanuel Thome Church',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Series', seriesSchema);
