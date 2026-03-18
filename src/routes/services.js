const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Service = require('../models/Service');
const User = require('../models/User');

// Middleware to verify JWT
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

// Get all services for the logged-in business owner
router.get('/', authenticate, verifyBusinessOwner, async (req, res) => {
  try {
    const services = await Service.find({ business: req.businessId }).lean();
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
    res.status(201).json(service);
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
    res.json(service);
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
