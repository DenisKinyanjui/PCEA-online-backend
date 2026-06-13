const { PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
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

module.exports = { uploadToR2, downloadFromR2AsBuffer };
