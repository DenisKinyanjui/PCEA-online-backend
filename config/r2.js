const { S3Client } = require('@aws-sdk/client-s3');

if (!process.env.R2_ENDPOINT) {
  console.warn('[R2] Warning: R2_ENDPOINT is not set. File uploads will fail.');
}

const r2Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  forcePathStyle: true, // required for Cloudflare R2 — prevents virtual-hosted-style bucket URLs
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY || '',
    secretAccessKey: process.env.R2_SECRET_KEY || '',
  },
});

const R2_BUCKET = process.env.R2_BUCKET || 'pceaonline';

module.exports = { r2Client, R2_BUCKET };
