const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const quiz = require('../controllers/quizController');
const quizBulkImport = require('../controllers/quizBulkImportController');

const member = [protect, authorize('member')];
const admin = [protect, authorize('super_admin', 'church_admin')];

router.get('/questions/preview', quiz.getPreviewQuestions);
router.get('/leaderboard/public', quiz.getPublicLeaderboard);
router.get('/questions', ...member, quiz.getQuestions);
router.post('/answers', ...member, quiz.submitAnswer);
router.get('/me', ...member, quiz.getMemberSummary);
router.get('/leaderboard', ...member, quiz.getLeaderboard);
router.post('/streak/dismiss', ...member, quiz.dismissStreakPopup);

router.get('/manage/questions', ...admin, quiz.getManagedQuestions);
router.post('/manage/questions/bulk/preview', ...admin, quizBulkImport.previewBulkQuestions);
router.post('/manage/questions/bulk/import', ...admin, quizBulkImport.importBulkQuestions);
router.post('/manage/questions', ...admin, quiz.createQuestion);
router.put('/manage/questions/:id', ...admin, quiz.updateQuestion);
router.patch('/manage/questions/:id/archive', ...admin, quiz.archiveQuestion);
router.get('/manage/seasons', ...admin, quiz.getSeasons);
router.post('/manage/seasons', ...admin, quiz.createSeason);
router.put('/manage/seasons/:id', ...admin, quiz.updateSeason);
router.post('/manage/seasons/:id/review', ...admin, quiz.reviewSeason);
router.post('/manage/seasons/:id/finalize', ...admin, quiz.finalizeSeason);

module.exports = router;