require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const { supabase } = require('./config/supabase');
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const uploadRoutes = require('./routes/upload');
const chatbotRoutes = require('./routes/chatbot');
const businessRoutes = require('./routes/business');
const servicesRoutes = require('./routes/services');
const { scheduleReminders } = require('./services/emailService');

const app = express();

// Security headers
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// Middleware
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'https://booqlly.vercel.app',
  'https://serenity-frontend-phi.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000'
].filter(Boolean);

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts, please try again later.' }
});

app.use('/api/', apiLimiter);
app.use('/api/auth/', authLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/chatbot', chatbotRoutes);
app.use('/api/business', businessRoutes);
app.use('/api/services', servicesRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Remove test email route in production
if (process.env.NODE_ENV !== 'production') {
  const testEmailRoutes = require('./routes/testEmail');
  app.use('/api/test-email', testEmailRoutes);
}

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  const status = err.status || 500;
  const message = status < 500 ? err.message : 'Something went wrong';
  console.error(`[ERROR] ${req.method} ${req.path}:`, err);
  res.status(status).json({
    error: message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  
  // Start scheduled reminders with error handling
  try {
    scheduleReminders();
    console.log('Reminder scheduler started');
  } catch (err) {
    console.error('Failed to start reminder scheduler:', err.message);
    console.log('Server will continue without reminders');
  }
});

module.exports = app;
