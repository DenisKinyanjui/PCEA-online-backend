const { body, query } = require('express-validator');
const Sermon = require('../models/Sermon');
const validate = require('../middleware/validate');

const sermonValidation = [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('preacher').trim().notEmpty().withMessage('Preacher is required'),
  body('date').isISO8601().withMessage('Valid date is required'),
  validate,
];

const getSermons = async (req, res, next) => {
  try {
    const { search, preacher, church, year, page = 1, limit = 10 } = req.query;
    const filter = {};

    if (search) filter.$text = { $search: search };
    if (preacher) filter.preacher = { $regex: preacher, $options: 'i' };
    if (church) filter.church = { $regex: church, $options: 'i' };
    if (year) {
      filter.date = { $gte: new Date(`${year}-01-01`), $lte: new Date(`${year}-12-31T23:59:59`) };
    }

    const skip = (Number(page) - 1) * Number(limit);
    const total = await Sermon.countDocuments(filter);
    const sermons = await Sermon.find(filter)
      .sort({ date: -1 })
      .skip(skip)
      .limit(Number(limit))
      .select('-content -__v');

    res.json({ success: true, total, page: Number(page), pages: Math.ceil(total / Number(limit)), data: sermons });
  } catch (error) {
    next(error);
  }
};

const getSermon = async (req, res, next) => {
  try {
    const sermon = await Sermon.findById(req.params.id).select('-__v');
    if (!sermon) return res.status(404).json({ success: false, message: 'Sermon not found' });
    res.json({ success: true, data: sermon });
  } catch (error) {
    next(error);
  }
};

const getSermonMeta = async (req, res, next) => {
  try {
    const [preachers, churches] = await Promise.all([
      Sermon.distinct('preacher'),
      Sermon.distinct('church'),
    ]);
    res.json({
      success: true,
      data: {
        preachers: preachers.filter(Boolean).sort(),
        churches: churches.filter(Boolean).sort(),
      },
    });
  } catch (error) {
    next(error);
  }
};

const createSermon = async (req, res, next) => {
  try {
    const body = { ...req.body };
    // Enforce church scope for non-super_admin
    if (req.user.role !== 'super_admin') {
      body.church = req.scopedChurchName;
    }
    const sermon = await Sermon.create(body);
    res.status(201).json({ success: true, data: sermon });
  } catch (error) {
    next(error);
  }
};

const updateSermon = async (req, res, next) => {
  try {
    const sermon = await Sermon.findById(req.params.id);
    if (!sermon) return res.status(404).json({ success: false, message: 'Sermon not found' });

    // church_admin / transcriptionist may only edit their church's sermons
    if (req.user.role !== 'super_admin' && sermon.church !== req.scopedChurchName) {
      return res.status(403).json({ success: false, message: 'Not authorized to edit this sermon' });
    }

    const body = { ...req.body };
    if (req.user.role !== 'super_admin') body.church = req.scopedChurchName;

    const updated = await Sermon.findByIdAndUpdate(req.params.id, body, {
      new: true, runValidators: true,
    }).select('-__v');

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

const deleteSermon = async (req, res, next) => {
  try {
    const sermon = await Sermon.findById(req.params.id);
    if (!sermon) return res.status(404).json({ success: false, message: 'Sermon not found' });

    if (req.user.role !== 'super_admin' && sermon.church !== req.scopedChurchName) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this sermon' });
    }

    await sermon.deleteOne();
    res.json({ success: true, message: 'Sermon deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// Create a full sermon from an AI-processed SermonJob
const createFromAI = async (req, res, next) => {
  try {
    const { jobId, title, preacher, date, scriptureReferences, summary, church, audioUrl, video } = req.body;

    if (!jobId) return res.status(400).json({ success: false, message: 'jobId is required' });
    if (!title) return res.status(400).json({ success: false, message: 'title is required' });
    if (!preacher) return res.status(400).json({ success: false, message: 'preacher is required' });
    if (!date) return res.status(400).json({ success: false, message: 'date is required' });

    const SermonJob = require('../models/SermonJob');
    const job = await SermonJob.findById(jobId);
    if (!job) return res.status(404).json({ success: false, message: 'Processing job not found' });
    if (job.status !== 'completed') {
      return res.status(422).json({ success: false, message: 'Job has not completed successfully yet' });
    }

    const resolvedChurch =
      req.user.role !== 'super_admin' ? req.scopedChurchName : church || 'P.C.E.A Emmanuel Thome Church';

    // Map AI sections to the existing sermon content schema
    const sections = job.aiResult.sections || [];
    const intro = sections.find((s) => s.type === 'introduction');
    const conclusion = sections.find((s) => s.type === 'conclusion');
    const points = sections
      .filter((s) => s.type === 'point')
      .map((s) => ({ title: s.title, description: s.content, verses: s.scripture }));

    const sermon = await Sermon.create({
      title,
      preacher,
      date,
      church: resolvedChurch,
      scriptureReferences: scriptureReferences || job.aiResult.keyVerses || [],
      summary: summary || job.aiResult.summary || '',
      audioUrl: audioUrl || job.sourceFileUrl || '',
      video: video || null,
      content: {
        introduction: intro ? intro.content : '',
        points,
        conclusion: conclusion ? conclusion.content : '',
      },
    });

    res.status(201).json({ success: true, data: sermon });
  } catch (error) {
    next(error);
  }
};

module.exports = { getSermons, getSermon, getSermonMeta, createSermon, updateSermon, deleteSermon, sermonValidation, createFromAI };
