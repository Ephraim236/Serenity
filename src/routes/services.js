const express = require('express');
const router = express.Router();
const Service = require('../models/Service');
const User = require('../models/User');

// Middleware to verify JWT (for business owner routes)
const authenticate = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Verify business owner
const verifyBusinessOwner = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || user.role !== 'business') {
      return res.status(403).json({ error: 'Only business owners can manage services' });
    }
    req.businessId = user._id;
    next();
  } catch (err) {
    res.status(500).json({ error: 'Failed to verify user' });
  }
};

// PUBLIC: Get all active services across all businesses (for clients)
// This endpoint is public and does not require authentication
router.get('/public', async (req, res) => {
  try {
    const { category, businessId, limit = 50, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build query
    const query = { isActive: true };
    if (category) query.category = category;
    if (businessId) query.business = businessId;

    const services = await Service.find(query)
      .populate('business', 'businessName businessPhone location')
      .select('name description category duration price image averageRating reviewCount business createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Service.countDocuments(query);

    res.json({
      services,
      pagination: {
        total,
        page: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    console.error('Get public services error:', err);
    res.status(500).json({ error: 'Failed to fetch services' });
  }
});

// Get services for a specific business (public)
router.get('/business/:businessId', async (req, res) => {
  try {
    const { businessId } = req.params;
    const { limit = 50 } = req.query;

    const services = await Service.find({ 
      business: businessId, 
      isActive: true 
    })
      .select('name description category duration price image averageRating reviewCount')
      .limit(parseInt(limit));

    res.json(services);
  } catch (err) {
    console.error('Get business services error:', err);
    res.status(500).json({ error: 'Failed to fetch services' });
  }
});

// Get all services for the logged-in business owner
router.get('/', authenticate, verifyBusinessOwner, async (req, res) => {
  try {
    const services = await Service.find({ business: req.businessId })
      .select('name description category duration price image isActive averageRating reviewCount')
      .lean();
    res.json(services);
  } catch (err) {
    console.error('Get services error:', err);
    res.status(500).json({ error: 'Failed to fetch services' });
  }
});

// Create a new service
router.post('/', authenticate, verifyBusinessOwner, async (req, res) => {
  try {
    const { name, description, category, duration, price, image } = req.body;

    if (!name || !category || !duration || !price) {
      return res.status(400).json({ error: 'Name, category, duration, and price are required' });
    }

    const service = new Service({
      name,
      description,
      category,
      duration: parseInt(duration),
      price: parseFloat(price),
      image,
      business: req.businessId,
      isActive: true
    });

    await service.save();
    res.status(201).json({
      _id: service._id,
      name: service.name,
      description: service.description,
      category: service.category,
      duration: service.duration,
      price: service.price,
      image: service.image,
      isActive: service.isActive,
      averageRating: service.averageRating,
      reviewCount: service.reviewCount
    });
  } catch (err) {
    console.error('Create service error:', err);
    res.status(500).json({ error: 'Failed to create service' });
  }
});

// Update a service
router.put('/:id', authenticate, verifyBusinessOwner, async (req, res) => {
  try {
    const { name, description, category, duration, price, image, isActive } = req.body;

    const service = await Service.findOne({ _id: req.params.id, business: req.businessId });
    
    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    if (name) service.name = name;
    if (description !== undefined) service.description = description;
    if (category) service.category = category;
    if (duration) service.duration = parseInt(duration);
    if (price) service.price = parseFloat(price);
    if (image !== undefined) service.image = image;
    if (isActive !== undefined) service.isActive = isActive;

    await service.save();
    res.json({
      _id: service._id,
      name: service.name,
      description: service.description,
      category: service.category,
      duration: service.duration,
      price: service.price,
      image: service.image,
      isActive: service.isActive,
      averageRating: service.averageRating,
      reviewCount: service.reviewCount
    });
  } catch (err) {
    console.error('Update service error:', err);
    res.status(500).json({ error: 'Failed to update service' });
  }
});

// Delete (deactivate) a service
router.delete('/:id', authenticate, verifyBusinessOwner, async (req, res) => {
  try {
    const service = await Service.findOne({ _id: req.params.id, business: req.businessId });
    
    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    // Instead of deleting, we deactivate the service
    service.isActive = false;
    await service.save();

    res.json({ message: 'Service deactivated successfully' });
  } catch (err) {
    console.error('Delete service error:', err);
    res.status(500).json({ error: 'Failed to delete service' });
  }
});

module.exports = router;
