const { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const path = require('path');
const crypto = require('crypto');
const { r2Client, R2_BUCKET } = require('../config/r2');

function generateKey(originalName, folder = '') {
  const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
  const ext = path.extname(originalName).toLowerCase();
  const base = folder ? `${folder}/` : '';
  return `${base}${uniqueSuffix}${ext}`;
}

function buildPublicUrl(key) {
  const endpoint = (process.env.R2_ENDPOINT || '').replace(/\/$/, '');
  return `${endpoint}/${R2_BUCKET}/${key}`;
}

async function uploadToR2(buffer, originalName, mimeType, folder = '') {
  const key = generateKey(originalName, folder);

  try {
    await r2Client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
        ContentDisposition: `attachment; filename="${originalName}"`,
      })
    );
  } catch (err) {
    // Surface a clear R2-specific error instead of a generic 500
    const code = err.Code || err.code || err.name || 'R2Error';
    const detail = err.message || 'Unknown R2 error';
    const wrapped = new Error(`R2 upload failed [${code}]: ${detail}`);
    wrapped.statusCode = code === 'AccessDenied' ? 403 : 502;
    throw wrapped;
  }

  return { key, url: buildPublicUrl(key) };
}

async function downloadFromR2AsBuffer(key) {
  const response = await r2Client.send(
    new GetObjectCommand({ Bucket: R2_BUCKET, Key: key })
  );

  const chunks = [];
  for await (const chunk of response.Body) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

// Returns the raw GetObject response so callers can stream `Body` (e.g. to an HTTP response).
// `range` is an HTTP Range header value (e.g. "bytes=0-") for partial reads — audio/video seeking.
async function getR2Object(key, { range } = {}) {
  return r2Client.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key, ...(range && { Range: range }) }));
}

// URLs from uploadToR2 point at the private R2 API endpoint, which browsers can't read.
// Returns the object key for such a URL, or null for any other (public) URL.
function r2KeyFromUrl(url) {
  if (!url) return null;
  const prefix = `${buildPublicUrl('')}`;
  return url.startsWith(prefix) && url.length > prefix.length ? url.slice(prefix.length) : null;
}

// Best-effort delete — a leftover object is harmless, so failures are logged, not thrown.
async function deleteFromR2(key) {
  if (!key) return;
  try {
    await r2Client.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
  } catch (err) {
    console.warn(`[R2] Failed to delete "${key}": ${err.message}`);
  }
}

module.exports = { uploadToR2, downloadFromR2AsBuffer, getR2Object, deleteFromR2, r2KeyFromUrl };
