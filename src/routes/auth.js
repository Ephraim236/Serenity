const express = require('express');
const router = express.Router();
const passport = require('passport');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { generateToken } = require('../config/passport');

// Middleware to verify JWT for profile routes
const authenticate = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Local Registration
router.post('/register', async (req, res) => {
  try {
    const { 
      email,
      password, 
      name, 
      role, 
      businessName,
      businessEmail,
      businessPhone,
      location,
      serviceHours,
      operatingDays,
      businessImages
    } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Create user
    const userData = {
      email,
      password,
      name,
      role: role || 'client',
      authProvider: 'local'
    };

    // Add business details if role is business
    if (role === 'business') {
      userData.businessName = businessName;
      userData.businessEmail = businessEmail;
      userData.businessPhone = businessPhone;
      userData.location = location;
      userData.serviceHours = serviceHours;
      userData.operatingDays = operatingDays;
      userData.businessImages = businessImages;
    }

    const user = await User.create(userData);

    const token = generateToken(user);

    res.status(201).json({
      message: 'Registration successful',
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatar: user.avatar,
        businessName: user.businessName
      }
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Local Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user with password
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user);

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatar: user.avatar,
        businessName: user.businessName
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Google OAuth Routes
router.get('/google', passport.authenticate('google', { 
  scope: ['profile', 'email']
}));

router.get('/google/callback', 
  passport.authenticate('google', { failureRedirect: '/login?error=oauth' }),
  (req, res) => {
    const token = generateToken(req.user);
    // Determine frontend URL based on environment
    let frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    
    // If running locally, use localhost:5173
    if (process.env.NODE_ENV !== 'production') {
      frontendUrl = 'http://localhost:5173';
    }
    
    // Redirect to frontend with token
    const redirectUrl = `${frontendUrl}/auth/callback?token=${token}`;
    res.redirect(redirectUrl);
  }
);

// Get current user
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      avatar: user.avatar,
      businessName: user.businessName,
      businessEmail: user.businessEmail,
      businessPhone: user.businessPhone,
      location: user.location,
      serviceHours: user.serviceHours,
      operatingDays: user.operatingDays,
      businessImages: user.businessImages
    });
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Check if Google OAuth is configured
router.get('/google/status', (req, res) => {
  const isConfigured = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  res.json({ googleAuthAvailable: isConfigured });
});

// Update business profile
router.put('/profile', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const { 
      businessName, 
      businessEmail, 
      businessPhone, 
      location,
      serviceHours,
      operatingDays,
      businessImages
    } = req.body;
    
    // Update business profile fields (only update if provided)
    if (businessName !== undefined) user.businessName = businessName;
    if (businessEmail !== undefined) user.businessEmail = businessEmail;
    if (businessPhone !== undefined) user.businessPhone = businessPhone;
    
    // Handle location - merge with existing or set new
    if (location !== undefined) {
      user.location = {
        address: location.address || '',
        city: location.city || '',
        state: location.state || '',
        zipCode: location.zipCode || '',
        country: location.country || ''
      };
    }
    
    // Handle serviceHours - ensure proper format
    if (serviceHours !== undefined) {
      user.serviceHours = serviceHours;
    }
    
    if (operatingDays !== undefined) user.operatingDays = operatingDays;
    if (businessImages !== undefined) user.businessImages = businessImages;
    
    await user.save();
    
    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatar: user.avatar,
        businessName: user.businessName,
        businessEmail: user.businessEmail,
        businessPhone: user.businessPhone,
        location: user.location,
        serviceHours: user.serviceHours,
        operatingDays: user.operatingDays,
        businessImages: user.businessImages
      }
    });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

module.exports = router;

