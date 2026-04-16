require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const config = require('./config/environment');

const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const uploadRoutes = require('./routes/upload');
const chatbotRoutes = require('./routes/chatbot');
const businessRoutes = require('./routes/business');
const servicesRoutes = require('./routes/services');
const testEmailRoutes = require('./routes/testEmail');
const { scheduleReminders } = require('./services/emailService');
require('./config/passport');

const app = express();

// Connect to MongoDB (non-blocking)
connectDB();

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https://*.blob.vercel-storage.com", "https://images.unsplash.com", "https://*.googleusercontent.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'", "https://serenity-gamma-two.vercel.app", "https://*.vercel.app"]
    }
  }
}));

// Rate limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { error: 'Too many uploads. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api/', generalLimiter);
app.use('/api/upload', uploadLimiter);

// CORS - dynamic from config
const corsOrigins = config.getCorsOrigins();
console.log('🌐 CORS origins:', corsOrigins);

app.use(cors({
  origin: corsOrigins,
  credentials: true,
  exposedHeaders: ['Content-Length', 'X-Content-Type-Options']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files for local development only
if (!config.useBlobStorage) {
  const uploadsDir = path.join(__dirname, '..', 'uploads');
  try {
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    app.use('/uploads', express.static(uploadsDir, {
      maxAge: '7d',
      etag: true,
      lastModified: true
    }));
  } catch (err) {
    console.log('⚠️  Uploads directory not available (read-only filesystem)');
  }
}

// Session configuration
app.use(session({
  secret: config.JWT_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: config.isProduction,
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    sameSite: config.isProduction ? 'strict' : 'lax'
  }
}));

app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/chatbot', chatbotRoutes);
app.use('/api/business', businessRoutes);
app.use('/api/services', servicesRoutes);
app.use('/api/test-email', testEmailRoutes);

// Storage health check
app.get('/api/storage-health', async (req, res) => {
  try {
    if (config.useBlobStorage) {
      const blobModule = await import('@vercel/blob');
      const blob = blobModule.default || blobModule;
      // Minimal test - list with prefix empty would list all, so just check access
      res.json({ 
        status: 'ok', 
        storage: 'vercel-blob',
        configured: true
      });
    } else {
      // Check local disk write access
      const fs = require('fs');
      const uploadsDir = path.join(__dirname, '..', 'uploads');
      const testFile = path.join(uploadsDir, `.test-${Date.now()}.tmp`);
      
      try {
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
        res.json({ status: 'ok', storage: 'local-disk', writable: true });
      } catch (e) {
        res.status(500).json({ status: 'error', storage: 'local-disk', error: e.message });
      }
    }
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Health check with storage status
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: config.NODE_ENV,
    storage: config.useBlobStorage ? 'vercel-blob' : 'local-disk',
    corsOrigins: corsOrigins
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Enhanced error handler
app.use((err, req, res, next) => {
  console.error(`[ERROR] ${req.method} ${req.path}`, {
    message: err.message,
    code: err.code,
    stack: config.isProduction ? undefined : err.stack
  });
  
  // Don't leak stack traces in production
  const response = {
    error: err.publicMessage || err.message || 'Something went wrong!'
  };
  
  if (!config.isProduction) {
    response.stack = err.stack;
    response.code = err.code;
  }
  
  res.status(err.status || 500).json(response);
});

const PORT = config.PORT;

const server = app.listen(PORT, () => {
  console.log('========================================');
  console.log(`✅  SERVER STARTED - ${new Date().toISOString()}`);
  console.log(`   Port: ${PORT}`);
  console.log(`   Environment: ${config.NODE_ENV}`);
  console.log(`   Storage Backend: ${config.useBlobStorage ? '📦 Vercel Blob' : '💾 Local Disk (dev only)'}`);
  console.log(`   Frontend URL: ${config.FRONTEND_URL}`);
  console.log(`   CORS Origins: ${corsOrigins.join(', ')}`);
  
  // Validation warnings
  if (!config.JWT_SECRET || config.JWT_SECRET.length < 32) {
    console.log('⚠️  WARNING: JWT_SECRET is weak or missing. Generate a strong random key!');
  }
  
  if (config.isProduction && !config.BLOB_READ_WRITE_TOKEN) {
    console.log('❌ CRITICAL: BLOB_READ_WRITE_TOKEN not set in production!');
    console.log('   Uploads will fail. Set it in Vercel Dashboard → Settings → Environment Variables');
  }
  
  if (config.useBlobStorage && !config.BLOB_STORE_URL) {
    console.log('ℹ️  BLOB_STORE_URL not set - using default derived from token');
  }
  
  console.log('========================================');
  
  // Start email scheduler
  scheduleReminders();
});

// Graceful shutdown
const shutdown = () => {
  console.log('\n🛑 Shutting down server...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
  
  // Force close after 10 seconds
  setTimeout(() => {
    console.log('⚠️  Forcing shutdown');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

// Uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  shutdown();
});

module.exports = app;
