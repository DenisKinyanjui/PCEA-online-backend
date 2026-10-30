const { body } = require('express-validator');
const mongoose = require('mongoose');
const User = require('../models/User');
const District = require('../models/District');
const validate = require('../middleware/validate');

const memberUpdateValidation = [
  body('name').isString().withMessage('Name is required').bail().trim().notEmpty().withMessage('Name is required'),
  body('email').isString().withMessage('Valid email is required').bail().isEmail().withMessage('Valid email is required'),
  body('districtId')
    .custom((value) => value === null || value === '' || /^[a-f\d]{24}$/i.test(value || ''))
    .withMessage('Select a valid district'),
  validate,
];

const getDistrictMembers = async (req, res, next) => {
  try {
    if (!req.user.district || !req.user.church) {
      return res.status(200).json({
        success: true,
        assigned: false,
        message: 'Your district has not been assigned yet',
        data: [],
      });
    }

    const members = await User.find({
      role: 'member',
      church: req.user.church._id,
      district: req.user.district._id,
    })
      .select('name')
      .sort({ name: 1 })
      .lean();

    res.json({
      success: true,
      assigned: true,
      district: {
        id: req.user.district._id,
        name: req.user.district.name,
        elderName: req.user.district.elderName || '',
        deacons: req.user.district.deacons || [],
      },
      total: members.length,
      data: members.map(({ _id, name }) => ({ id: _id, name })),
    });
  } catch (error) {
    next(error);
  }
};

const getMembersForAdmin = async (req, res, next) => {
  try {
    if (req.user.role === 'church_admin' && !req.user.church) {
      return res.status(403).json({ success: false, message: 'No church assigned to this account' });
    }

    const filter = { role: 'member' };
    if (req.user.role === 'church_admin') filter.church = req.user.church._id;

    const members = await User.find(filter)
      .select('name email church district createdAt +membershipLocation')
      .populate('church', 'name _id')
      .populate('district', 'name _id')
      .sort({ name: 1 })
      .lean();

    res.json({
      success: true,
      total: members.length,
      data: members.map((member) => ({
        id: member._id,
        name: member.name,
        email: member.email,
        church: member.church ? { id: member.church._id, name: member.church.name } : null,
        district: member.district ? { id: member.district._id, name: member.district.name } : null,
        location: member.membershipLocation || '',
        createdAt: member.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
};

const updateMember = async (req, res, next) => {
  try {
    const member = await User.findOne({ _id: req.params.id, role: 'member' })
      .select('+membershipLocation');
    if (!member) return res.status(404).json({ success: false, message: 'Member not found' });

    if (
      req.user.role === 'church_admin' &&
      (!req.user.church || member.church?.toString() !== req.user.church._id.toString())
    ) {
      return res.status(403).json({ success: false, message: 'You can only manage members of your church' });
    }

    const { name, email, districtId } = req.body;
    member.name = name;
    member.email = email.toLowerCase();

    if (districtId) {
      const district = await District.findOne({ _id: districtId, isActive: true });
      if (!district) {
        return res.status(400).json({ success: false, message: 'The selected district is unavailable' });
      }
      if (member.church?.toString() !== district.church.toString()) {
        return res.status(400).json({ success: false, message: "District must belong to the member's church" });
      }
      member.district = district._id;
      member.membershipLocation = '';
    } else {
      member.district = null;
    }

    await member.save();
    await member.populate('district', 'name _id');
    res.json({
      success: true,
      data: {
        id: member._id,
        name: member.name,
        email: member.email,
        district: member.district ? { id: member.district._id, name: member.district.name } : null,
        location: member.membershipLocation || '',
      },
    });
  } catch (error) {
    next(error);
  }
};

const deleteMember = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }
    const member = await User.findOne({ _id: req.params.id, role: 'member' });
    if (!member) return res.status(404).json({ success: false, message: 'Member not found' });

    if (
      req.user.role === 'church_admin' &&
      (!req.user.church || member.church?.toString() !== req.user.church._id.toString())
    ) {
      return res.status(403).json({ success: false, message: 'You can only manage members of your church' });
    }

    await member.deleteOne();
    res.json({ success: true, message: 'Member removed successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDistrictMembers,
  getMembersForAdmin,
  updateMember,
  deleteMember,
  memberUpdateValidation,
};
