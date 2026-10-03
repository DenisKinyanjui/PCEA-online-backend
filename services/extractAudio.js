// Prepares uploaded audio/video for ASR.
//
// MiMo ASR only accepts WAV/MP3 and caps the base64 payload at 10 MB
// (see services/ai/mimoService.js), which is far smaller than a typical
// 45–90 minute sermon recording. So the audio track is re-encoded as a small
// speech-friendly MP3 (mono, 16 kHz, 32 kbps, ~14 MB per hour) and split into
// fixed-length segments that are each transcribed separately.
//
// Segment size: 10 min at 32 kbps ≈ 2.4 MB raw ≈ 3.2 MB base64 — well under
// the cap, and small enough that a single request stays within the timeout.
const { spawn } = require('child_process');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const ffmpegPath = require('ffmpeg-static');

const ASR_CHUNK_SECONDS = Number(process.env.ASR_CHUNK_SECONDS || 600);

// Returns an array of MP3 Buffers, in playback order.
async function toAsrChunks(mediaBuffer, originalFileName) {
  if (!ffmpegPath) throw new Error('ffmpeg binary is not available on this server');

  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sermon-'));
  const inputPath = path.join(workDir, `input${path.extname(originalFileName || '') || '.bin'}`);

  await fs.writeFile(inputPath, mediaBuffer);
  try {
    await new Promise((resolve, reject) => {
      const ff = spawn(ffmpegPath, [
        '-y', '-i', inputPath,
        '-vn',                 // drop video (no-op for audio files)
        '-ac', '1',            // mono
        '-ar', '16000',        // 16 kHz is plenty for speech
        '-b:a', '32k',
        '-f', 'segment',
        '-segment_time', String(ASR_CHUNK_SECONDS),
        '-reset_timestamps', '1',
        path.join(workDir, 'chunk-%03d.mp3'),
      ]);
      let stderr = '';
      ff.stderr.on('data', (d) => { stderr = (stderr + d).slice(-2000); });
      ff.on('error', reject);
      ff.on('close', (code) => {
        if (code === 0) return resolve();
        const noAudio = /does not contain any stream|Output file #0 does not contain|matches no streams/i.test(stderr);
        reject(new Error(noAudio
          ? 'The uploaded file has no audio track to transcribe.'
          : `Could not prepare the audio for transcription (ffmpeg exit ${code}).`));
      });
    });

    const chunkNames = (await fs.readdir(workDir))
      .filter((name) => /^chunk-\d+\.mp3$/.test(name))
      .sort();
    if (!chunkNames.length) throw new Error('The uploaded file has no audio track to transcribe.');

    return await Promise.all(chunkNames.map((name) => fs.readFile(path.join(workDir, name))));
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }
}

module.exports = { toAsrChunks };
