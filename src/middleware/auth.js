const { supabase } = require('../config/supabase');

// Middleware to verify Supabase JWT token
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    res.status(401).json({ error: 'Authentication failed' });
  }
};

// Verify business owner
const verifyBusinessOwner = async (req, res, next) => {
  try {
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('role, business_name')
      .eq('id', req.user.id)
      .single();

    if (error || !profile || profile.role !== 'business') {
      return res.status(403).json({ error: 'Only business owners can access this resource' });
    }

    req.businessId = req.user.id;
    next();
  } catch (err) {
    console.error('Business verification error:', err);
    res.status(500).json({ error: 'Failed to verify business owner' });
  }
};

module.exports = {
  authenticate,
  verifyBusinessOwner
};
