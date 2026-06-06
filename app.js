const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// CORS
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim());

// Wildcard subdomain patterns, e.g. "*.lvh.me:5173" or "*.pceaonlineministry.com".
// The * must be at the start and represents one subdomain segment ([a-z0-9-]+).
// Strategy: split on '*', escape the suffix's dots, build a regex.
//   "*.lvh.me:5173" → suffix ".lvh.me:5173" → /^https?:\/\/[a-z0-9-]+\.lvh\.me:5173$/
const subdomainPatterns = (process.env.CORS_SUBDOMAIN_PATTERNS || '')
  .split(',')
  .map((p) => p.trim())
  .filter(Boolean)
  .map((pattern) => {
    const suffix = pattern.startsWith('*') ? pattern.slice(1) : pattern;
    const escapedSuffix = suffix.replace(/\./g, '\\.'); // only dots need escaping
    return new RegExp(`^https?:\\/\\/[a-z0-9-]+${escapedSuffix}$`);
  });

const isAllowedOrigin = (origin) => {
  if (allowedOrigins.includes(origin)) return true;
  return subdomainPatterns.some((re) => re.test(origin));
};

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // non-browser clients
      if (isAllowedOrigin(origin)) return callback(null, true);
      callback(new Error(`CORS: origin '${origin}' not allowed`));
    },
    credentials: true,
  })
);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// Static files (uploaded audio / attachments)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// API routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/churches', require('./routes/churches'));
app.use('/api/users', require('./routes/users'));
app.use('/api/sermons', require('./routes/sermons'));
app.use('/api/series', require('./routes/series'));
app.use('/api/uploads', require('./routes/uploads'));

// 404 handler for unmatched routes
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// Centralised error handler (must be last)
app.use(errorHandler);

module.exports = app;
