const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Service = require('../models/Service');

// Demo businesses for when MongoDB is not connected
const DEMO_BUSINESSES = [
  {
    _id: 'demo-business-1',
    name: 'SarahsSalon',
    email: 'sarah@example.com',
    businessName: "Sarah's Luxury Salon",
    businessEmail: 'contact@sarahssalon.com',
    businessPhone: '+233 50 123 4567',
    location: {
      address: '123 Accra Main Road',
      city: 'Accra',
      state: 'Greater Accra',
      country: 'Ghana'
    }
  },
  {
    _id: 'demo-business-2',
    name: 'EliteGrooming',
    email: 'elite@example.com',
    businessName: 'Elite Grooming Barbershop',
    businessEmail: 'book@elitebarbers.com',
    businessPhone: '+233 24 987 6543',
    location: {
      address: '456 Tema Community 11',
      city: 'Tema',
      state: 'Greater Accra',
      country: 'Ghana'
    }
  },
  {
    _id: 'demo-business-3',
    name: 'ZenSpa',
    email: 'zen@example.com',
    businessName: 'Zen Spa & Wellness',
    businessEmail: 'relax@zenspa.com',
    businessPhone: '+233 30 456 7890',
    location: {
      address: '789 Osu Castle Road',
      city: 'Accra',
      state: 'Greater Accra',
      country: 'Ghana'
    }
  }
];

// Demo services
const DEMO_SERVICES = [
  { _id: 's1', name: 'Luxury Facial', category: 'spa', duration: 60, price: 850, description: 'Deep cleansing and rejuvenation', isActive: true },
  { _id: 's2', name: 'Deep Tissue Massage', category: 'massage', duration: 90, price: 1200, description: 'Targeted pressure to release tension', isActive: true },
  { _id: 's3', name: 'Hot Stone Therapy', category: 'spa', duration: 90, price: 1400, description: 'Heated stones for deep relaxation', isActive: true },
  { _id: 's4', name: 'Classic Haircut', category: 'hair', duration: 30, price: 150, description: 'Professional haircut styling', isActive: true },
  { _id: 's5', name: 'Beard Trim', category: 'hair', duration: 30, price: 120, description: 'Beard grooming and shaping', isActive: true },
  { _id: 's6', name: 'Hair Styling', category: 'hair', duration: 60, price: 350, description: 'Professional hair styling', isActive: true },
  { _id: 's7', name: 'Manicure & Pedicure', category: 'nails', duration: 75, price: 300, description: 'Full nail care package', isActive: true },
  { _id: 's8', name: 'Bridal Makeup', category: 'spa', duration: 90, price: 1500, description: 'Professional bridal makeup', isActive: true }
];

// Get all active businesses
router.get('/', async (req, res) => {
  try {
    const businesses = await User.find({ role: 'business' })
      .select('name email businessName businessEmail businessPhone location serviceHours operatingDays')
      .lean();
    
    res.json(businesses);
  } catch (err) {
    console.log('Using demo businesses (MongoDB not connected)');
    res.json(DEMO_BUSINESSES);
  }
});

// Get business details with services
router.get('/:id', async (req, res) => {
  try {
    const business = await User.findOne({ _id: req.params.id, role: 'business' })
      .select('name email businessName businessEmail businessPhone location serviceHours operatingDays')
      .lean();
    
    if (!business) {
      // Check if it's a demo business
      const demoBusiness = DEMO_BUSINESSES.find(b => b._id === req.params.id);
      if (demoBusiness) {
        return res.json({
          ...demoBusiness,
          services: DEMO_SERVICES
        });
      }
      return res.status(404).json({ error: 'Business not found' });
    }
    
    // Get active services for this business
    const services = await Service.find({ business: req.params.id, isActive: true }).lean();
    
    res.json({
      ...business,
      services
    });
  } catch (err) {
    console.log('Using demo business details (MongoDB not connected)');
    const demoBusiness = DEMO_BUSINESSES.find(b => b._id === req.params.id);
    if (demoBusiness) {
      res.json({
        ...demoBusiness,
        services: DEMO_SERVICES
      });
    } else {
      res.status(404).json({ error: 'Business not found' });
    }
  }
});

module.exports = router;
