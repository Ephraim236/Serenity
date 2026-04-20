require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');
const path = require('path');
const fs = require('fs');

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

// Connect to MongoDB
connectDB();

// Create uploads directory for local dev (ignore errors on read-only FS)
const uploadsDir = path.join(__dirname, '..', 'uploads');
try {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
} catch (err) {
  console.log('Uploads dir unavailable (expected on Vercel read-only FS)');
}

// Middleware
app.use(cors({
  origin: ['https://serenity-gamma-two.vercel.app', 'https://serenity-frontend-green.vercel.app', 'https://serenity-frontend-ftg1723m8-ephraim236s-projects.vercel.app', 'https://serenity-frontend-2.onrender.com', 'http://localhost:5173', 'http://localhost:5000'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session
app.use(session({
  secret: process.env.JWT_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000
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

// Note: Using base64 data URLs instead of static file serving for serverless compatibility

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err);
  res.status(err.status || 500).json({
    error: err.message || 'Something went wrong',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  scheduleReminders();
});

module.exports = app;
