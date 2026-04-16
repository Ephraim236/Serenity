require('dotenv').config();

const requiredEnvVars = [
  'JWT_SECRET',
  'MONGODB_URI'
];

const missing = requiredEnvVars.filter(key => !process.env[key]);
if (missing.length > 0 && process.env.NODE_ENV === 'production') {
  throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
}

// Derive blob storage mode
const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
const useBlobStorage = BLOB_TOKEN && BLOB_TOKEN !== 'your-vercel-blob-token-here' && !BLOB_TOKEN.includes('your-');

module.exports = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: process.env.PORT || 3000,
  MONGODB_URI: process.env.MONGODB_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  GOOGLE_CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL,
  FRONTEND_URL: process.env.FRONTEND_URL || (process.env.NODE_ENV === 'production'
    ? 'https://serenity-frontend-green.vercel.app'
    : 'http://localhost:5173'),
  BLOB_READ_WRITE_TOKEN: BLOB_TOKEN,
  BLOB_STORE_URL: process.env.BLOB_STORE_URL,
  EMAIL_USER: process.env.EMAIL_USER,
  EMAIL_PASS: process.env.EMAIL_PASS,
  
  // Computed flags
  isProduction: process.env.NODE_ENV === 'production',
  useBlobStorage,
  
  // CORS origins
  getCorsOrigins() {
    if (process.env.NODE_ENV === 'production') {
      const origins = [
        this.FRONTEND_URL,
        'https://serenity-gamma-two.vercel.app',
        'https://serenity-frontend-green.vercel.app'
      ].filter(Boolean);
      return [...new Set(origins)]; // dedupe
    }
    return ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'];
  }
};
