const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');

// Demo businesses for when Supabase is not connected
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
    },
    image: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzYWxvbiUyMHNhbG9uJTIwaW50ZXJpb3J8ZW58MXx8fHwxNzAxMjM0NTY3fDA&ixlib=rb-4.1.0&q=80&w=1080',
    averageRating: 4.8,
    reviewCount: 124
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
    },
    image: 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiYXJiZXIlMjBzaG9wfGVudDF8fHx8MTcwMTIzNDU2N3ww&ixlib=rb-4.1.0&q=80&w=1080',
    averageRating: 4.6,
    reviewCount: 89
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
    },
    image: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzcGElMjBtYXNzYWdlfGVufDF8fHx8MTc3NDQwNzgwMHww&ixlib=rb-4.1.0&q=80&w=1080',
    averageRating: 4.9,
    reviewCount: 215
  }
];

// Demo services
const DEMO_SERVICES = [
  { _id: 's1', name: 'Luxury Facial', category: 'spa', duration: 60, price: 850, description: 'Deep cleansing and rejuvenation', isActive: true, averageRating: 4.8, reviewCount: 124, business: 'demo-business-1', businessName: "Sarah's Luxury Salon" },
  { _id: 's2', name: 'Deep Tissue Massage', category: 'massage', duration: 90, price: 1200, description: 'Targeted pressure to release tension', isActive: true, averageRating: 4.9, reviewCount: 98, business: 'demo-business-1', businessName: "Sarah's Luxury Salon" },
  { _id: 's3', name: 'Hot Stone Therapy', category: 'spa', duration: 90, price: 1400, description: 'Heated stones for deep relaxation', isActive: true, averageRating: 4.7, reviewCount: 86, business: 'demo-business-1', businessName: "Sarah's Luxury Salon" },
  { _id: 's4', name: 'Classic Haircut', category: 'hair', duration: 30, price: 150, description: 'Professional haircut styling', isActive: true, averageRating: 4.6, reviewCount: 312, business: 'demo-business-2', businessName: 'Elite Grooming Barbershop' },
  { _id: 's5', name: 'Beard Trim', category: 'hair', duration: 30, price: 120, description: 'Beard grooming and shaping', isActive: true, averageRating: 4.5, reviewCount: 245, business: 'demo-business-2', businessName: 'Elite Grooming Barbershop' },
  { _id: 's6', name: 'Hair Styling', category: 'hair', duration: 60, price: 350, description: 'Professional hair styling', isActive: true, averageRating: 4.9, reviewCount: 178, business: 'demo-business-2', businessName: 'Elite Grooming Barbershop' },
  { _id: 's7', name: 'Manicure & Pedicure', category: 'nails', duration: 75, price: 300, description: 'Full nail care package', isActive: true, averageRating: 4.4, reviewCount: 92, business: 'demo-business-3', businessName: 'Zen Spa & Wellness' },
  { _id: 's8', name: 'Bridal Makeup', category: 'spa', duration: 90, price: 1500, description: 'Professional bridal makeup', isActive: true, averageRating: 5.0, reviewCount: 56, business: 'demo-business-3', businessName: 'Zen Spa & Wellness' }
];

// Get all active businesses
router.get('/', async (req, res) => {
  try {
    const { data: businesses, error } = await supabaseAdmin
      .from('profiles')
      .select('id, name, email, business_name, business_email, business_phone, location, service_hours, operating_days, business_images, average_rating, review_count')
      .eq('role', 'business')
      .eq('is_active', true);

    if (error) {
      console.error('Supabase error:', error);
      return res.json(DEMO_BUSINESSES);
    }

    const businessesWithImages = (businesses || []).map(business => ({
      ...business,
      image: business.business_images && business.business_images.length > 0
        ? business.business_images[0]
        : null
    }));

    res.json(businessesWithImages);
  } catch (err) {
    console.log('Database error, using demo businesses:', err.message);
    res.json(DEMO_BUSINESSES);
  }
});

// Get business details with services
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: business, error } = await supabaseAdmin
      .from('profiles')
      .select('id, name, email, business_name, business_email, business_phone, location, service_hours, operating_days, business_images, average_rating, review_count')
      .eq('id', id)
      .eq('role', 'business')
      .eq('is_active', true)
      .single();

    if (!business) {
      const demoBusiness = DEMO_BUSINESSES.find(b => b._id === id);
      if (demoBusiness) {
        return res.json({
          ...demoBusiness,
          services: DEMO_SERVICES
        });
      }
      return res.status(404).json({ error: 'Business not found' });
    }

    // Get active services for this business
    const { data: services } = await supabaseAdmin
      .from('services')
      .select('id, name, description, category, duration, price, image, average_rating, review_count, business_name')
      .eq('business_id', id)
      .eq('is_active', true);

    const response = {
      ...business,
      image: business.business_images && business.business_images.length > 0 ? business.business_images[0] : null,
      services: services || []
    };

    res.json(response);
  } catch (err) {
    console.log('Using demo business details:', err.message);
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
