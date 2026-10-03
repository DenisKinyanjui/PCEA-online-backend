const path = require('path');
const SermonJob = require('../models/SermonJob');
const { transcribeMedia, generateSermonStructure } = require('./ai');
const { validateSermonStructure } = require('./ai/validateSermonStructure');
const { downloadFromR2AsBuffer } = require('./r2UploadService');
const { toAsrChunks } = require('./extractAudio');

// Pause between ASR segment requests so a long sermon doesn't trip MiMo's rate limit
const ASR_SEGMENT_DELAY_MS = Number(process.env.ASR_SEGMENT_DELAY_MS || 3000);

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

      const downloadStart = Date.now();
      const buffer = await downloadFromR2AsBuffer(fileKey);
      console.log(
        `[AI Pipeline] Job ${jobId} — downloaded ${(buffer.length / (1024 * 1024)).toFixed(2)} MB from R2 in ${Date.now() - downloadStart}ms (${job.sourceFileType}, ${job.sourceMimeType || 'unknown mime'})`
      );

      const aiStart = Date.now();
      if (job.sourceFileType === 'audio' || job.sourceFileType === 'video') {
        // Full sermons blow past ASR's 10 MB payload cap, so transcribe a
        // compact MP3 of the audio track in fixed-length segments and join them.
        const chunks = await toAsrChunks(buffer, job.originalFileName);
        const totalMb = chunks.reduce((sum, c) => sum + c.length, 0) / (1024 * 1024);
        console.log(`[AI Pipeline] Job ${jobId} — prepared ${chunks.length} audio segment(s), ${totalMb.toFixed(2)} MB total`);

        const parts = [];
        for (let i = 0; i < chunks.length; i++) {
          // Sequential and paced on purpose: keeps us clear of MiMo rate limits
          if (i > 0) await new Promise((resolve) => setTimeout(resolve, ASR_SEGMENT_DELAY_MS));
          parts.push(await transcribeMedia(chunks[i], `segment-${i + 1}.mp3`, 'audio/mpeg'));
          console.log(`[AI Pipeline] Job ${jobId} — transcribed segment ${i + 1}/${chunks.length}`);
        }
        rawText = parts.join('\n\n');
      } else {
        rawText = await extractDocumentText(buffer, job.originalFileName);
      }
      console.log(`[AI Pipeline] Job ${jobId} — transcription/extraction finished in ${Date.now() - aiStart}ms (${rawText.length} chars)`);

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
      const rawAiResult = await generateSermonStructure(rawText, job.userPrompt);
      aiResult = validateSermonStructure(rawAiResult);
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
      job.aiResult = aiResult;

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
