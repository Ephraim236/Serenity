const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Service = require('../models/Service');

// Get all active businesses
router.get('/', async (req, res) => {
  try {
    const businesses = await User.find({ role: 'business' })
      .select('name email businessName businessEmail businessPhone location serviceHours operatingDays')
      .lean();
    
    res.json(businesses);
  } catch (err) {
    console.error('Get businesses error:', err);
    res.status(500).json({ error: 'Failed to fetch businesses' });
  }
});

// Get business details with services
router.get('/:id', async (req, res) => {
  try {
    const business = await User.findOne({ _id: req.params.id, role: 'business' })
      .select('name email businessName businessEmail businessPhone location serviceHours operatingDays')
      .lean();
    
    if (!business) {
      return res.status(404).json({ error: 'Business not found' });
    }
    
    // Get active services for this business
    const services = await Service.find({ business: req.params.id, isActive: true }).lean();
    
    res.json({
      ...business,
      services
    });
  } catch (err) {
    console.error('Get business error:', err);
    res.status(500).json({ error: 'Failed to fetch business details' });
  }
});

module.exports = router;
