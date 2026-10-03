// Connectivity/latency check for the MiMo ASR endpoint. Run it on the machine
// that actually hosts the backend (e.g. the Render/Railway/VPS shell):
//
//   npm run test:mimo
//
// Sends synthetic WAVs of increasing size through transcribeMedia() and
// reports how long each takes. Uploads from some networks stall on payloads
// above a few hundred KB; this shows where (if anywhere) your host does.
// Each request is tiny in token terms, so cost is negligible.
require('dotenv').config();

// Fail fast per size instead of waiting through retries. Must be set before
// mimoService is required, since it reads this at load time.
process.env.MIMO_MAX_RETRIES = '0';

const { transcribeMedia } = require('../services/ai/mimoService');

function makeWav(seconds, sampleRate = 8000) {
  const numSamples = sampleRate * seconds;
  const dataSize = numSamples * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < numSamples; i++) {
    buf.writeInt16LE(Math.round(2000 * Math.sin((2 * Math.PI * 200 * i) / sampleRate)), 44 + i * 2);
  }
  return buf;
}

(async () => {
  for (const seconds of [1, 10, 30, 60]) {
    const wav = makeWav(seconds);
    const label = `${seconds}s (${(wav.length / 1024).toFixed(0)} KB)`;
    const start = Date.now();
    try {
      await transcribeMedia(wav, `test${seconds}s.wav`, 'audio/wav');
      console.log(`OK    ${label} in ${Date.now() - start}ms`);
    } catch (err) {
      console.log(`FAIL  ${label} after ${Date.now() - start}ms: ${err.message}`);
    }
  }
})();
