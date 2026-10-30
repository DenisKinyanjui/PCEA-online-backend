const mongoose = require('mongoose');

const districtSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'District name is required'],
      trim: true,
    },
    elderName: {
      type: String,
      trim: true,
      maxlength: [100, 'District elder name must be 100 characters or fewer'],
      default: '',
    },
    deacons: {
      type: [{
        type: String,
        trim: true,
        maxlength: [100, 'Deacon name must be 100 characters or fewer'],
      }],
      default: [],
    },
    church: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Church',
      required: [true, 'A church must be assigned to this district'],
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

districtSchema.index({ church: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('District', districtSchema);
