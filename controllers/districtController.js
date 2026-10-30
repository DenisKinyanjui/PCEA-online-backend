const { body } = require('express-validator');
const District = require('../models/District');
const Church = require('../models/Church');
const validate = require('../middleware/validate');

const districtValidation = [
  body('name')
    .isString()
    .withMessage('District name is required')
    .bail()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('District name must be between 2 and 100 characters'),
  body('elderName')
    .optional({ nullable: true })
    .isString()
    .withMessage('District elder name must be text')
    .bail()
    .trim()
    .isLength({ max: 100 })
    .withMessage('District elder name must be 100 characters or fewer'),
  body('deacons')
    .optional()
    .isArray({ max: 12 })
    .withMessage('Enter no more than 12 deacons'),
  body('deacons.*')
    .optional()
    .isString()
    .withMessage('Deacon names must be text')
    .bail()
    .trim()
    .notEmpty()
    .withMessage('Deacon names cannot be empty')
    .bail()
    .isLength({ max: 100 })
    .withMessage('Deacon names must be 100 characters or fewer'),
  validate,
];

const getAdminChurch = async (user) => {
  if (user.role !== 'super_admin') return user.church;
  if (user.church) return user.church;
  return Church.findOne({ slug: 'pcea-emmanuel-thome-church', isActive: true }).select('_id name');
};

const findManagedDistrict = async (req, res) => {
  const church = await getAdminChurch(req.user);
  if (!church) {
    res.status(400).json({ success: false, message: 'No active church is assigned for district management' });
    return null;
  }

  const district = await District.findOne({ _id: req.params.id, church: church._id });
  if (!district) {
    res.status(404).json({ success: false, message: 'District not found' });
    return null;
  }
  return district;
};

const getDistricts = async (req, res, next) => {
  try {
    const districts = await District.find({ isActive: true })
      .select('name elderName')
      .sort({ name: 1 })
      .lean();
    res.json({ success: true, total: districts.length, data: districts });
  } catch (error) {
    next(error);
  }
};

const getAdminDistricts = async (req, res, next) => {
  try {
    const church = await getAdminChurch(req.user);
    if (!church) {
      return res.status(400).json({ success: false, message: 'No active church is assigned for district management' });
    }

    const districts = await District.find({ church: church._id, isActive: true })
      .select('name elderName deacons')
      .sort({ name: 1 })
      .lean();
    res.json({ success: true, total: districts.length, data: districts });
  } catch (error) {
    next(error);
  }
};

const createDistrict = async (req, res, next) => {
  try {
    const church = await getAdminChurch(req.user);

    if (!church) {
      return res.status(400).json({ success: false, message: 'No active church is assigned for district creation' });
    }

    const name = req.body.name.trim();
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const existing = await District.findOne({
      church: church._id,
      name: { $regex: `^${escapedName}$`, $options: 'i' },
    });
    if (existing) {
      return res.status(409).json({ success: false, message: 'A district with this name already exists' });
    }

    const district = await District.create({
      name,
      church: church._id,
      elderName: req.body.elderName?.trim() ?? '',
      deacons: (req.body.deacons ?? []).map((deacon) => deacon.trim()).filter(Boolean),
    });
    res.status(201).json({ success: true, data: district });
  } catch (error) {
    next(error);
  }
};

const updateDistrict = async (req, res, next) => {
  try {
    const district = await findManagedDistrict(req, res);
    if (!district) return;

    const name = req.body.name.trim();
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const duplicate = await District.findOne({
      _id: { $ne: district._id },
      church: district.church,
      name: { $regex: `^${escapedName}$`, $options: 'i' },
    });
    if (duplicate) {
      return res.status(409).json({ success: false, message: 'A district with this name already exists' });
    }

    district.name = name;
    district.elderName = req.body.elderName?.trim() ?? '';
    district.deacons = (req.body.deacons ?? []).map((deacon) => deacon.trim()).filter(Boolean);
    await district.save();
    res.json({ success: true, data: district });
  } catch (error) {
    next(error);
  }
};

const deleteDistrict = async (req, res, next) => {
  try {
    const district = await findManagedDistrict(req, res);
    if (!district) return;

    const User = require('../models/User');
    const memberCount = await User.countDocuments({ role: 'member', district: district._id });
    if (memberCount > 0) {
      return res.status(409).json({
        success: false,
        message: `This district has ${memberCount} member(s). Reassign or unassign them before deleting it.`,
      });
    }

    await district.deleteOne();
    res.json({ success: true, message: 'District deleted successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDistricts,
  getAdminDistricts,
  createDistrict,
  updateDistrict,
  deleteDistrict,
  districtValidation,
};
