const express = require('express');
const router = express.Router();
const { supabase, supabaseAdmin } = require('../config/supabase');
const { authenticate } = require('../middleware/auth');
const { sendEmail, sendPasswordResetEmail } = require('../services/emailService');

// Register new user
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

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }

    // Register user with Supabase Auth
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        role: role || 'client'
      }
    });

    if (error) {
      console.error('Supabase registration error:', error);
      if (error.message.includes('already registered')) {
        return res.status(400).json({ error: 'Email already registered' });
      }
      return res.status(400).json({ error: error.message || 'Registration failed' });
    }

    const userId = data.user.id;

    // Create profile
    const profileData = {
      id: userId,
      email,
      name,
      role: role || 'client',
      auth_provider: 'local'
    };

    // Add business details if role is business
    if (role === 'business') {
      profileData.business_name = businessName;
      profileData.business_email = businessEmail;
      profileData.business_phone = businessPhone;
      profileData.location = location || {};
      profileData.service_hours = serviceHours || {};
      profileData.operating_days = operatingDays || [];
      profileData.business_images = businessImages || [];
    }

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert(profileData);

    if (profileError) {
      console.error('Profile creation error:', profileError);
      // Try to clean up the auth user if profile creation fails
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return res.status(500).json({ error: 'Failed to create profile' });
    }

    // Generate a custom JWT for the frontend
    const token = generateToken(userId, email, role || 'client');

    res.status(201).json({
      message: 'Registration successful',
      token,
      user: {
        id: userId,
        email,
        name,
        role: role || 'client',
        avatar: '',
        businessName: businessName || ''
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

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Sign in with Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error || !data.user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = data.user;
    const token = data.session.access_token;

    // Get profile
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profile) {
      // Update last login
      await supabaseAdmin
        .from('profiles')
        .update({ last_login: new Date() })
        .eq('id', user.id);
    }

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: profile?.name || user.user_metadata?.name || '',
        role: profile?.role || 'client',
        avatar: profile?.avatar || '',
        businessName: profile?.business_name || ''
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Google OAuth - redirect to Supabase Auth
router.get('/google', (req, res) => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const redirectTo = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/auth/callback`;
  const authUrl = `${supabaseUrl}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectTo)}`;
  res.redirect(authUrl);
});

// Get current user
router.get('/me', authenticate, async (req, res) => {
  try {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', req.user.id)
      .single();

    if (!profile) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: profile.id,
      email: profile.email,
      name: profile.name,
      role: profile.role,
      avatar: profile.avatar || '',
      businessName: profile.business_name || '',
      businessEmail: profile.business_email || '',
      businessPhone: profile.business_phone || '',
      location: profile.location || {},
      serviceHours: profile.service_hours || {},
      operatingDays: profile.operating_days || [],
      businessImages: profile.business_images || []
    });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Forgot password route
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Use Supabase Auth password reset
    const { error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: email,
      options: {
        redirectTo: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password`
      }
    });

    if (error) {
      console.error('Password reset error:', error);
    }

    // Always return success to prevent email enumeration
    res.json({ 
      message: 'If your email exists in our system, you will receive a password reset link' 
    });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Password reset failed' });
  }
});

// Check if Google OAuth is configured
router.get('/google/status', (req, res) => {
  const isConfigured = !!process.env.GOOGLE_CLIENT_ID;
  res.json({ googleAuthAvailable: isConfigured });
});

// Get business profile
router.get('/profile', authenticate, async (req, res) => {
  try {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', req.user.id)
      .single();

    if (!profile) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      businessName: profile.business_name || '',
      businessEmail: profile.business_email || '',
      businessPhone: profile.business_phone || '',
      businessImage: profile.business_images?.[0] || '',
      businessImages: profile.business_images || [],
      location: profile.location || {},
      serviceHours: profile.service_hours || {},
      operatingDays: profile.operating_days || []
    });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Get business locations for map (public endpoint)
router.get('/business-locations', async (req, res) => {
  try {
    const { data: businesses } = await supabaseAdmin
      .from('profiles')
      .select('id, business_name, location, business_phone, business_email, average_rating, review_count')
      .eq('role', 'business')
      .eq('is_active', true)
      .not('location->>latitude', 'is', null)
      .not('location->>longitude', 'is', null);

    const locations = (businesses || []).map(business => ({
      id: business.id,
      name: business.business_name,
      latitude: business.location?.latitude,
      longitude: business.location?.longitude,
      phone: business.business_phone,
      email: business.business_email,
      averageRating: business.average_rating,
      reviewCount: business.review_count
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

    const { data: business } = await supabaseAdmin
      .from('profiles')
      .select('business_name, location, business_phone, business_email, average_rating, review_count')
      .eq('id', businessId)
      .eq('role', 'business')
      .eq('is_active', true)
      .single();

    if (!business) {
      return res.status(404).json({ error: 'Business not found' });
    }

    if (!business.location?.latitude || !business.location?.longitude) {
      return res.status(400).json({ error: 'Business location not set' });
    }

    const address = `${business.location.address || ''}, ${business.location.city || ''}, ${business.location.state || ''} ${business.location.zipCode || ''}, ${business.location.country || ''}`.trim();

    res.json({
      id: businessId,
      name: business.business_name,
      latitude: business.location.latitude,
      longitude: business.location.longitude,
      phone: business.business_phone,
      email: business.business_email,
      address,
      averageRating: business.average_rating,
      reviewCount: business.review_count
    });
  } catch (err) {
    console.error('Get business location error:', err);
    res.status(500).json({ error: 'Failed to fetch business location' });
  }
});

// Update business profile
router.put('/profile', authenticate, async (req, res) => {
  try {
    const { 
      businessName, 
      businessEmail, 
      businessPhone, 
      location,
      serviceHours,
      operatingDays,
      businessImages
    } = req.body;

    const updateData = {};
    if (businessName !== undefined) updateData.business_name = businessName;
    if (businessEmail !== undefined) updateData.business_email = businessEmail;
    if (businessPhone !== undefined) updateData.business_phone = businessPhone;
    if (location !== undefined) updateData.location = location;
    if (serviceHours !== undefined) updateData.service_hours = serviceHours;
    if (operatingDays !== undefined) updateData.operating_days = operatingDays;
    if (businessImages !== undefined) updateData.business_images = businessImages;

    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .update(updateData)
      .eq('id', req.user.id)
      .select()
      .single();

    if (error) {
      console.error('Profile update error:', error);
      return res.status(500).json({ error: 'Failed to update profile' });
    }

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        role: profile.role,
        avatar: profile.avatar,
        businessName: profile.business_name,
        businessEmail: profile.business_email,
        businessPhone: profile.business_phone,
        location: profile.location,
        serviceHours: profile.service_hours,
        operatingDays: profile.operating_days,
        businessImages: profile.business_images
      }
    });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// ==================== REVIEWS & RATINGS ROUTES ====================

// Get business reviews (public)
router.get('/businesses/:businessId/reviews', async (req, res) => {
  try {
    const { businessId } = req.params;
    const { page = 1, limit = 10, sort = 'newest' } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const range = offset + parseInt(limit) - 1;

    let orderBy = { created_at: 'desc' };
    if (sort === 'highest') orderBy = { rating: 'desc', created_at: 'desc' };
    if (sort === 'lowest') orderBy = { rating: 'asc', created_at: 'desc' };

    const { data: reviews, error: reviewsError, count } = await supabaseAdmin
      .from('reviews')
      .select('*', { count: 'exact' })
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .range(offset, range);

    if (reviewsError) {
      console.error('Get reviews error:', reviewsError);
      return res.status(500).json({ error: 'Failed to fetch reviews' });
    }

    // Get user names for reviews
    const userIds = [...new Set(reviews?.map(r => r.user_id) || [])];
    const { data: users } = await supabaseAdmin
      .from('profiles')
      .select('id, name, avatar')
      .in('id', userIds);

    const usersMap = new Map(users?.map(u => [u.id, u]) || []);

    const formattedReviews = reviews?.map(review => ({
      ...review,
      user: usersMap.get(review.user_id) || { name: 'Anonymous', avatar: '' }
    })) || [];

    res.json({
      reviews: formattedReviews,
      total: count || 0,
      page: parseInt(page),
      totalPages: Math.ceil((count || 0) / parseInt(limit))
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

    const offset = (parseInt(page) - 1) * parseInt(limit);

    let orderBy = { created_at: 'desc' };
    if (sort === 'highest') orderBy = { rating: 'desc', created_at: 'desc' };
    if (sort === 'lowest') orderBy = { rating: 'asc', created_at: 'desc' };

    const { data: reviews, error: reviewsError, count } = await supabaseAdmin
      .from('reviews')
      .select('*', { count: 'exact' })
      .eq('service_id', serviceId)
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (reviewsError) {
      console.error('Get service reviews error:', reviewsError);
      return res.status(500).json({ error: 'Failed to fetch reviews' });
    }

    const userIds = [...new Set(reviews?.map(r => r.user_id) || [])];
    const { data: users } = await supabaseAdmin
      .from('profiles')
      .select('id, name, avatar')
      .in('id', userIds);

    const usersMap = new Map(users?.map(u => [u.id, u]) || []);

    const formattedReviews = reviews?.map(review => ({
      ...review,
      user: usersMap.get(review.user_id) || { name: 'Anonymous', avatar: '' }
    })) || [];

    res.json({
      reviews: formattedReviews,
      total: count || 0,
      page: parseInt(page),
      totalPages: Math.ceil((count || 0) / parseInt(limit))
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
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { data: reviews, error: reviewsError, count } = await supabaseAdmin
      .from('reviews')
      .select('*', { count: 'exact' })
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (reviewsError) {
      console.error('Get my reviews error:', reviewsError);
      return res.status(500).json({ error: 'Failed to fetch reviews' });
    }

    // Get business and service names
    const businessIds = [...new Set(reviews?.map(r => r.business_id) || [])];
    const serviceIds = [...new Set(reviews?.map(r => r.service_id).filter(Boolean) || [])];

    const { data: businesses } = await supabaseAdmin
      .from('profiles')
      .select('id, business_name')
      .in('id', businessIds);

    const { data: services } = await supabaseAdmin
      .from('services')
      .select('id, name')
      .in('id', serviceIds);

    const businessMap = new Map(businesses?.map(b => [b.id, b.business_name]) || []);
    const serviceMap = new Map(services?.map(s => [s.id, s.name]) || []);

    const formattedReviews = reviews?.map(review => ({
      ...review,
      business: { businessName: businessMap.get(review.business_id) || '' },
      service: { name: serviceMap.get(review.service_id) || '' }
    })) || [];

    res.json({
      reviews: formattedReviews,
      total: count || 0,
      page: parseInt(page),
      totalPages: Math.ceil((count || 0) / parseInt(limit))
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

    if (!businessId || !rating) {
      return res.status(400).json({ error: 'Business ID and rating are required' });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    // Verify business exists
    const { data: business } = await supabaseAdmin
      .from('profiles')
      .select('id, role')
      .eq('id', businessId)
      .eq('role', 'business')
      .single();

    if (!business) {
      return res.status(404).json({ error: 'Business not found' });
    }

    // If serviceId provided, verify service exists and belongs to business
    if (serviceId) {
      const { data: service } = await supabaseAdmin
        .from('services')
        .select('id, business_id')
        .eq('id', serviceId)
        .single();

      if (!service || service.business_id !== businessId) {
        return res.status(400).json({ error: 'Invalid service for this business' });
      }
    }

    // If appointmentId provided, verify it belongs to user and is completed
    if (appointmentId) {
      const { data: appointment } = await supabaseAdmin
        .from('appointments')
        .select('id, status')
        .eq('id', appointmentId)
        .eq('user_id', req.user.id)
        .eq('business_id', businessId)
        .eq('status', 'completed')
        .single();

      if (!appointment) {
        return res.status(400).json({ error: 'Invalid or incomplete appointment' });
      }
    }

    // Check if user already reviewed this business/service combination
    let existingReview;
    if (serviceId) {
      const { data } = await supabaseAdmin
        .from('reviews')
        .select('*')
        .eq('user_id', req.user.id)
        .eq('business_id', businessId)
        .eq('service_id', serviceId)
        .single();
      existingReview = data;
    } else {
      const { data } = await supabaseAdmin
        .from('reviews')
        .select('*')
        .eq('user_id', req.user.id)
        .eq('business_id', businessId)
        .is('service_id', null)
        .single();
      existingReview = data;
    }

    if (existingReview) {
      // Update existing review
      const updateData = { rating, comment, tags, is_verified: appointmentId ? true : existingReview.is_verified };
      if (appointmentId) updateData.appointment_id = appointmentId;

      const { data: updated, error } = await supabaseAdmin
        .from('reviews')
        .update(updateData)
        .eq('id', existingReview.id)
        .select()
        .single();

      if (error) {
        console.error('Update review error:', error);
        return res.status(500).json({ error: 'Failed to update review' });
      }

      return res.json({
        message: 'Review updated successfully',
        review: updated
      });
    }

    // Create new review
    const { data: review, error } = await supabaseAdmin
      .from('reviews')
      .insert({
        user_id: req.user.id,
        business_id: businessId,
        service_id: serviceId || null,
        appointment_id: appointmentId || null,
        rating,
        comment,
        tags: tags || [],
        is_verified: !!appointmentId
      })
      .select()
      .single();

    if (error) {
      console.error('Create review error:', error);
      return res.status(500).json({ error: 'Failed to submit review' });
    }

    // Get business owner email for notification
    const { data: businessOwner } = await supabaseAdmin
      .from('profiles')
      .select('email, name')
      .eq('id', businessId)
      .single();

    if (businessOwner && businessOwner.email) {
      const subject = 'New Review Received - Booqlly';
      const sanitizedComment = (comment || '').replace(/[<>]/g, '');
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
              ${sanitizedComment ? '<p><em>"' + sanitizedComment + '"</em></p>' : ''}
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

    const { data: review, error: fetchError } = await supabaseAdmin
      .from('reviews')
      .select('*')
      .eq('id', reviewId)
      .single();

    if (fetchError || !review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    if (review.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to delete this review' });
    }

    const businessId = review.business_id;
    const serviceId = review.service_id;

    const { error: deleteError } = await supabaseAdmin
      .from('reviews')
      .delete()
      .eq('id', reviewId);

    if (deleteError) {
      console.error('Delete review error:', deleteError);
      return res.status(500).json({ error: 'Failed to delete review' });
    }

    res.json({ message: 'Review deleted successfully' });
  } catch (err) {
    console.error('Delete review error:', err);
    res.status(500).json({ error: 'Failed to delete review' });
  }
});

// Helper function to generate JWT token (for frontend compatibility)
function generateToken(userId, email, role) {
  const jwt = require('jsonwebtoken');
  return jwt.sign(
    { id: userId, email, role },
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: '7d' }
  );
}

module.exports = router;
