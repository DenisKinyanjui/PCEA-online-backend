const path = require('path');
const SermonJob = require('../models/SermonJob');
const { transcribeAudio, generateSermonStructure } = require('./openaiService');
const { downloadFromR2AsBuffer } = require('./r2UploadService');

const VALID_SECTION_TYPES = new Set(['introduction', 'point', 'conclusion']);

async function extractDocumentText(buffer, filename) {
  const ext = path.extname(filename).toLowerCase();

  if (ext === '.pdf') {
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(buffer);
    return data.text;
  }

  if (ext === '.docx' || ext === '.doc') {
    const mammoth = require('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  if (ext === '.txt') {
    return buffer.toString('utf8');
  }

  throw new Error(`Unsupported document format: ${ext}`);
}

async function setStage(job, stageName, status, error = '') {
  job.stages[stageName].status = status;
  if (error) job.stages[stageName].error = error;
  await job.save();
}

async function runPipeline(jobId) {
  let job;
  try {
    job = await SermonJob.findById(jobId);
    if (!job) throw new Error('SermonJob not found: ' + jobId);
  } catch (err) {
    console.error('[AI Pipeline] Failed to load job:', err.message);
    return;
  }

  try {
    job.status = 'processing';
    await job.save();

    // ── Stage 1: Download from R2 + Transcription / Text extraction ──────────
    await setStage(job, 'transcribing', 'processing');

    let rawText;
    try {
      const fileKey = job.sourceFileKey;
      if (!fileKey) throw new Error('No R2 file key found on job — cannot download file');

      const buffer = await downloadFromR2AsBuffer(fileKey);

      if (job.sourceFileType === 'audio') {
        rawText = await transcribeAudio(buffer, job.originalFileName);
      } else {
        rawText = await extractDocumentText(buffer, job.originalFileName);
      }

      job.rawTranscript = rawText;
      await setStage(job, 'transcribing', 'done');
    } catch (err) {
      await setStage(job, 'transcribing', 'failed', err.message);
      throw err;
    }

    // ── Stage 2: Analyzing ────────────────────────────────────────────────────
    await setStage(job, 'analyzing', 'processing');

    // ── Stage 3: Structuring ──────────────────────────────────────────────────
    await setStage(job, 'structuring', 'processing');

    let aiResult;
    try {
      aiResult = await generateSermonStructure(rawText, job.userPrompt);
      await setStage(job, 'analyzing', 'done');
      await setStage(job, 'structuring', 'done');
    } catch (err) {
      await setStage(job, 'analyzing', 'failed', err.message);
      await setStage(job, 'structuring', 'failed', err.message);
      throw err;
    }

    // ── Stage 4: Saving results ───────────────────────────────────────────────
    await setStage(job, 'saving', 'processing');

    try {
      job.aiResult = {
        titleSuggestions: Array.isArray(aiResult.titleSuggestions) ? aiResult.titleSuggestions : [],
        summary: aiResult.summary || '',
        sections: (Array.isArray(aiResult.sections) ? aiResult.sections : []).map((s) => ({
          type: VALID_SECTION_TYPES.has(s.type) ? s.type : 'point',
          title: s.title || '',
          content: s.content || '',
          scripture: Array.isArray(s.scripture) ? s.scripture : [],
        })),
        keyThemes: Array.isArray(aiResult.keyThemes) ? aiResult.keyThemes : [],
        keyVerses: Array.isArray(aiResult.keyVerses) ? aiResult.keyVerses : [],
      };

      await setStage(job, 'saving', 'done');
      job.status = 'completed';
      await job.save();
    } catch (err) {
      await setStage(job, 'saving', 'failed', err.message);
      throw err;
    }
  } catch (err) {
    console.error('[AI Pipeline] Job', jobId, 'failed:', err.message);
    if (job) {
      job.status = 'failed';
      job.errorMessage = err.message;
      await job.save().catch(() => {});
    }
  }
}

module.exports = { runPipeline };
