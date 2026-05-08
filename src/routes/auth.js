const express = require('express');
const router = express.Router();
const passport = require('passport');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const Service = require('../models/Service');
const Review = require('../models/Review');
const Appointment = require('../models/Appointment');
const { generateToken } = require('../config/passport');
const { sendEmail, sendPasswordResetEmail } = require('../services/emailService');

// Check if database is connected
const isDBConnected = () => mongoose.connection.readyState === 1;

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
    const dbConnected = isDBConnected();
    
    // Check database connection - allow demo registration if not connected
    if (!dbConnected) {
      // Demo mode registration
      const { 
        email,
        password, 
        name, 
        role, 
        businessName,
        businessEmail,
        businessPhone
      } = req.body;

      if (!email || !password || !name) {
        return res.status(400).json({ error: 'Email, password, and name are required' });
      }

      const token = generateToken({
        id: 'demo-' + Date.now(),
        email,
        name,
        role: role || 'client',
        businessName: businessName || ''
      });
      
      return res.status(201).json({
        message: 'Registration successful (demo mode)',
        token,
        user: {
          id: 'demo-' + Date.now(),
          email,
          name,
          role: role || 'client',
          avatar: '',
          businessName: businessName || ''
        }
      });
    }

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

// Demo mode credentials
const DEMO_USERS = {
  'demo@business.com': { password: 'demo123', name: 'Demo Business', role: 'business', businessName: 'Demo Salon' },
  'demo@client.com': { password: 'demo123', name: 'Demo Client', role: 'client' }
};

// Local Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Check if database is connected
    const dbConnected = isDBConnected();
    
    if (!dbConnected) {
      // Demo mode - allow login with demo credentials
      const demoUser = DEMO_USERS[email];
      if (demoUser && demoUser.password === password) {
        const token = generateToken({
          id: 'demo-' + Date.now(),
          email,
          name: demoUser.name,
          role: demoUser.role,
          businessName: demoUser.businessName
        });
        
        return res.json({
          message: 'Login successful (demo mode)',
          token,
          user: {
            id: 'demo-' + Date.now(),
            email,
            name: demoUser.name,
            role: demoUser.role,
            avatar: '',
            businessName: demoUser.businessName || ''
          }
        });
      }
      
      return res.status(401).json({ error: 'Invalid credentials or database not connected' });
    }

    // Database connected - normal login
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

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

// Forgot password route
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Check if database is connected
    const dbConnected = isDBConnected();
    
    if (!dbConnected) {
      // Demo mode
      const demoUser = Object.keys(DEMO_USERS).find(user => user === email);
      if (demoUser) {
        // In demo mode, just return success (don't actually send email)
        return res.json({ 
          message: 'If your email exists in our system, you will receive a password reset link' 
        });
      } else {
        // Still return success to prevent email enumeration
        return res.json({ 
          message: 'If your email exists in our system, you will receive a password reset link' 
        });
      }
    }

    // Database connected - normal operation
    const user = await User.findOne({ email });
    
    // Always return success to prevent email enumeration
    if (!user) {
      return res.json({ 
        message: 'If your email exists in our system, you will receive a password reset link' 
      });
    }

    // Generate reset token
    const crypto = require('crypto');
    const resetToken = crypto.randomBytes(32).toString('hex');
    
    // Hash token and set to user object
    user.resetPasswordToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');
    
    // Set token expiry (1 hour from now)
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    
    await user.save();

    // Send email with reset link
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password/${resetToken}`;
    
    try {
      await sendPasswordResetEmail(user.email, resetUrl);
      res.json({ 
        message: 'If your email exists in our system, you will receive a password reset link' 
      });
    } catch (emailError) {
      console.error('Email sending error:', emailError);
      res.status(500).json({ error: 'Failed to send reset email' });
    }
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Password reset failed' });
  }
});

// Reset password route
router.post('/reset-password/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: 'Token and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    // Check if database is connected
    const dbConnected = isDBConnected();
    
    if (!dbConnected) {
      // Demo mode - just return success
      return res.json({ message: 'Password reset successful (demo mode)' });
    }

    // Hash token to compare with database
    const crypto = require('crypto');
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    // Find user by token and check expiry
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    // Update password
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    
    await user.save();

    res.json({ message: 'Password has been reset successfully' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Password reset failed' });
  }
});

// Check if Google OAuth is configured
router.get('/google/status', (req, res) => {
  const isConfigured = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  res.json({ googleAuthAvailable: isConfigured });
});

// Get business profile
router.get('/profile', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
      businessName: user.businessName || '',
      businessEmail: user.businessEmail || '',
      businessPhone: user.businessPhone || '',
      businessImage: user.businessImage || '',
      businessImages: user.businessImages || [],
      location: user.location || {
        address: '',
        city: '',
        state: '',
        zipCode: '',
        country: ''
      },
      serviceHours: user.serviceHours || {},
      operatingDays: user.operatingDays || []
    });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Get business locations for map (public endpoint)
router.get('/business-locations', async (req, res) => {
  try {
    // Find all business users with location data
    const businesses = await User.find({
      role: 'business',
      isActive: true,
      'location.latitude': { $exists: true, $ne: null },
      'location.longitude': { $exists: true, $ne: null }
    }).select('businessName location.latitude location.longitude businessPhone businessEmail averageRating reviewCount');
    
    // Format response for map display
    const locations = businesses.map(business => ({
      id: business._id,
      name: business.businessName,
      latitude: business.location.latitude,
      longitude: business.location.longitude,
      phone: business.businessPhone,
      email: business.businessEmail,
      averageRating: business.averageRating,
      reviewCount: business.reviewCount
    }));
    
    res.json({ businesses: locations });
  } catch (err) {
    console.error('Get business locations error:', err);
    res.status(500).json({ error: 'Failed to fetch business locations' });
  }
});

// Get specific business location
router.get('/business-location/:businessId', async (req, res) => {
  try {
    const { businessId } = req.params;
    
    const business = await User.findOne({
      _id: businessId,
      role: 'business',
      isActive: true
    }).select('businessName location.latitude location.longitude businessPhone businessEmail address averageRating reviewCount');
    
    if (!business) {
      return res.status(404).json({ error: 'Business not found' });
    }
    
    if (!business.location.latitude || !business.location.longitude) {
      return res.status(400).json({ error: 'Business location not set' });
    }
    
    res.json({
      id: business._id,
      name: business.businessName,
      latitude: business.location.latitude,
      longitude: business.location.longitude,
      phone: business.businessPhone,
      email: business.businessEmail,
      address: `${business.location.address || ''}, ${business.location.city || ''}, ${business.location.state || ''} ${business.location.zipCode || ''}, ${business.location.country || ''}`.trim(),
      averageRating: business.averageRating,
      reviewCount: business.reviewCount
    });
  } catch (err) {
    console.error('Get business location error:', err);
    res.status(500).json({ error: 'Failed to fetch business location' });
  }
});

// Update business profile
router.put('/profile', authenticate, async (req, res) => {
  try {
    console.log('Profile update request - user:', req.user);
    
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
    
    console.log('Updating profile with data:', { businessName, businessEmail, businessPhone });
    
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
         country: location.country || '',
         // Update GPS coordinates if provided
         latitude: location.latitude !== undefined ? location.latitude : user.location?.latitude,
         longitude: location.longitude !== undefined ? location.longitude : user.location?.longitude
       };
     }
    
    // Handle serviceHours - ensure proper format
    if (serviceHours !== undefined) {
      user.serviceHours = serviceHours;
    }
    
    if (operatingDays !== undefined) user.operatingDays = operatingDays;
    if (businessImages !== undefined) user.businessImages = businessImages;
    
    await user.save();
    console.log('Profile saved successfully');
    
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
     console.error('Error stack:', err.stack);
     res.status(500).json({ error: 'Failed to update profile' });
   }
 });

// ==================== REVIEWS & RATINGS ROUTES ====================

// Get business reviews (public)
router.get('/businesses/:businessId/reviews', async (req, res) => {
  try {
    const { businessId } = req.params;
    const { page = 1, limit = 10, sort = 'newest' } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build sort object
    let sortObj = { createdAt: -1 };
    if (sort === 'highest') sortObj = { rating: -1, createdAt: -1 };
    if (sort === 'lowest') sortObj = { rating: 1, createdAt: -1 };

    const reviews = await Review.find({ business: businessId })
      .populate('user', 'name avatar')
      .sort(sortObj)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Review.countDocuments({ business: businessId });

    res.json({
      reviews,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit))
    });
  } catch (err) {
    console.error('Get business reviews error:', err);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// Get service reviews (public)
router.get('/services/:serviceId/reviews', async (req, res) => {
  try {
    const { serviceId } = req.params;
    const { page = 1, limit = 10, sort = 'newest' } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build sort object
    let sortObj = { createdAt: -1 };
    if (sort === 'highest') sortObj = { rating: -1, createdAt: -1 };
    if (sort === 'lowest') sortObj = { rating: 1, createdAt: -1 };

    const reviews = await Review.find({ service: serviceId })
      .populate('user', 'name avatar')
      .sort(sortObj)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Review.countDocuments({ service: serviceId });

    res.json({
      reviews,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit))
    });
  } catch (err) {
    console.error('Get service reviews error:', err);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// Get current user's reviews
router.get('/my-reviews', authenticate, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const reviews = await Review.find({ user: req.user.id })
      .populate('business', 'businessName')
      .populate('service', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Review.countDocuments({ user: req.user.id });

    res.json({
      reviews,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit))
    });
  } catch (err) {
    console.error('Get my reviews error:', err);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// Create or update review
router.post('/reviews', authenticate, async (req, res) => {
  try {
    const { businessId, serviceId, appointmentId, rating, comment, tags } = req.body;

    // Validate required fields
    if (!businessId || !rating) {
      return res.status(400).json({ error: 'Business ID and rating are required' });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    // Verify business exists
    const business = await User.findById(businessId);
    if (!business || business.role !== 'business') {
      return res.status(404).json({ error: 'Business not found' });
    }

    // If serviceId provided, verify service exists and belongs to business
    let service = null;
    if (serviceId) {
      service = await Service.findById(serviceId);
      if (!service || service.business.toString() !== businessId) {
        return res.status(400).json({ error: 'Invalid service for this business' });
      }
    }

    // If appointmentId provided, verify it belongs to user and is completed
    let appointment = null;
    if (appointmentId) {
      appointment = await Appointment.findOne({
        _id: appointmentId,
        user: req.user.id,
        business: businessId,
        status: 'completed'
      });
      if (!appointment) {
        return res.status(400).json({ error: 'Invalid or incomplete appointment' });
      }
    }

    // Check if user already reviewed this business/service combination
    const existingReviewQuery = {
      user: req.user.id,
      business: businessId
    };

    if (serviceId) {
      existingReviewQuery.service = serviceId;
    }

    const existingReview = await Review.findOne(existingReviewQuery);

    if (existingReview) {
      // Update existing review
      existingReview.rating = rating;
      if (comment !== undefined) existingReview.comment = comment;
      if (tags !== undefined) existingReview.tags = tags;
      existingReview.isVerified = appointment ? true : existingReview.isVerified;
      if (appointmentId) existingReview.appointment = appointmentId;

      await existingReview.save();

      // Update aggregated ratings
      await updateBusinessRating(businessId);
      if (serviceId) {
        await updateServiceRating(serviceId);
      }

      return res.json({
        message: 'Review updated successfully',
        review: existingReview
      });
    }

    // Create new review
    const review = new Review({
      user: req.user.id,
      business: businessId,
      service: serviceId || undefined,
      appointment: appointmentId || undefined,
      rating,
      comment,
      tags,
      isVerified: appointment ? true : false
    });

    await review.save();

    // Update aggregated ratings
    await updateBusinessRating(businessId);
    if (serviceId) {
      await updateServiceRating(serviceId);
    }

    // Optionally send email notification to business owner
    const businessOwner = await User.findById(businessId);
    if (businessOwner && businessOwner.email) {
      const subject = 'New Review Received - Booqlly';
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .rating { color: #f59e0b; font-size: 24px; }
            .footer { text-align: center; margin-top: 20px; color: #888; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>New Review Received</h1>
            </div>
            <div class="content">
              <p>Hello ${businessOwner.name},</p>
              <p>You've received a new ${'★'.repeat(rating)}${'☆'.repeat(5-rating)} (${rating}/5) review:</p>
              ${comment ? `<p><em>"${comment}"</em></p>` : ''}
              <p>You can view all your reviews in your admin dashboard.</p>
            </div>
            <div class="footer">
              <p>© 2026 Booqlly. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;
      sendEmail(businessOwner.email, subject, html).catch(err => console.log('Review email failed:', err.message));
    }

    res.status(201).json({
      message: 'Review submitted successfully',
      review
    });
  } catch (err) {
    console.error('Create review error:', err);
    res.status(500).json({ error: 'Failed to submit review' });
  }
});

// Delete review (only by owner or business owner)
router.delete('/reviews/:reviewId', authenticate, async (req, res) => {
  try {
    const { reviewId } = req.params;

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    // Check if user is the review author
    if (review.user.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to delete this review' });
    }

    const businessId = review.business;
    const serviceId = review.service;

    await Review.findByIdAndDelete(reviewId);

    // Update aggregated ratings
    await updateBusinessRating(businessId);
    if (serviceId) {
      await updateServiceRating(serviceId);
    }

    res.json({ message: 'Review deleted successfully' });
  } catch (err) {
    console.error('Delete review error:', err);
    res.status(500).json({ error: 'Failed to delete review' });
  }
});

// Helper function to update business average rating and review count
async function updateBusinessRating(businessId) {
  try {
    const stats = await Review.aggregate([
      { $match: { business: mongoose.Types.ObjectId(businessId) } },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          reviewCount: { $sum: 1 }
        }
      }
    ]);

    if (stats.length > 0) {
      await User.findByIdAndUpdate(businessId, {
        averageRating: Math.round(stats[0].averageRating * 10) / 10, // Round to 1 decimal
        reviewCount: stats[0].reviewCount
      });
    } else {
      await User.findByIdAndUpdate(businessId, {
        averageRating: 0,
        reviewCount: 0
      });
    }
  } catch (err) {
    console.error('Update business rating error:', err);
  }
}

// Helper function to update service average rating and review count
async function updateServiceRating(serviceId) {
  try {
    const stats = await Review.aggregate([
      { $match: { service: mongoose.Types.ObjectId(serviceId) } },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          reviewCount: { $sum: 1 }
        }
      }
    ]);

    if (stats.length > 0) {
      await Service.findByIdAndUpdate(serviceId, {
        averageRating: Math.round(stats[0].averageRating * 10) / 10,
        reviewCount: stats[0].reviewCount
      });
    } else {
      await Service.findByIdAndUpdate(serviceId, {
        averageRating: 0,
        reviewCount: 0
      });
    }
  } catch (err) {
    console.error('Update service rating error:', err);
  }
}

module.exports = router;

