const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false,
    },
    role: {
      type: String,
      enum: ['super_admin', 'church_admin', 'transcriptionist', 'member'],
      default: 'church_admin',
    },
    // null for super_admin; required for church staff and members
    church: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Church',
      default: null,
    },
    district: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'District',
      default: null,
    },
    membershipLocation: {
      type: String,
      trim: true,
      maxlength: [300, 'Location must be 300 characters or fewer'],
      select: false,
    },
  },
  { timestamps: true }
);

userSchema.path('church').validate(function (church) {
  return this.role === 'super_admin' || Boolean(church);
}, 'A church must be assigned to this account');

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
