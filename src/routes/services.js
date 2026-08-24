const express = require('express');
const router = express.Router();
const { supabase, supabaseAdmin } = require('../config/supabase');
const { authenticate, verifyBusinessOwner } = require('../middleware/auth');

// PUBLIC: Get all active services across all businesses (for clients)
router.get('/public', async (req, res) => {
  try {
    const { category, businessId, limit = 50, page = 1 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = supabaseAdmin
      .from('services')
      .select('*', { count: 'exact' })
      .eq('is_active', true);

    if (category) query = query.eq('category', category);
    if (businessId) query = query.eq('business_id', businessId);

    const { data: services, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (error) {
      console.error('Get public services error:', error);
      return res.status(500).json({ error: 'Failed to fetch services' });
    }

    res.json({
      services: services || [],
      pagination: {
        total: count || 0,
        page: parseInt(page),
        totalPages: Math.ceil((count || 0) / parseInt(limit))
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

    const { data: services, error } = await supabaseAdmin
      .from('services')
      .select('id, name, description, category, duration, price, image, average_rating, review_count, business_name')
      .eq('business_id', businessId)
      .eq('is_active', true)
      .limit(parseInt(limit));

    if (error) {
      console.error('Get business services error:', error);
      return res.status(500).json({ error: 'Failed to fetch services' });
    }

    res.json(services || []);
  } catch (err) {
    console.error('Get business services error:', err);
    res.status(500).json({ error: 'Failed to fetch services' });
  }
});

// Get all services for the logged-in business owner
router.get('/', authenticate, verifyBusinessOwner, async (req, res) => {
  try {
    const { data: services, error } = await supabaseAdmin
      .from('services')
      .select('id, name, description, category, duration, price, image, is_active, average_rating, review_count, business_name')
      .eq('business_id', req.businessId);

    if (error) {
      console.error('Get services error:', error);
      return res.status(500).json({ error: 'Failed to fetch services' });
    }

    res.json(services || []);
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

    // Get business name
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('business_name')
      .eq('id', req.businessId)
      .single();

    const { data: service, error } = await supabaseAdmin
      .from('services')
      .insert({
        name,
        description,
        category,
        duration: parseInt(duration),
        price: parseFloat(price),
        image: image || null,
        business_id: req.businessId,
        business_name: profile?.business_name || null,
        is_active: true
      })
      .select()
      .single();

    if (error) {
      console.error('Create service error:', error);
      return res.status(500).json({ error: 'Failed to create service' });
    }

    res.status(201).json(service);
  } catch (err) {
    console.error('Create service error:', err);
    res.status(500).json({ error: 'Failed to create service' });
  }
});

// Update a service
router.put('/:id', authenticate, verifyBusinessOwner, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, category, duration, price, image, isActive } = req.body;

    const updateData = {};
    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (category) updateData.category = category;
    if (duration) updateData.duration = parseInt(duration);
    if (price) updateData.price = parseFloat(price);
    if (image !== undefined) updateData.image = image;
    if (isActive !== undefined) updateData.is_active = isActive;

    const { data: service, error } = await supabaseAdmin
      .from('services')
      .update(updateData)
      .eq('id', id)
      .eq('business_id', req.businessId)
      .select()
      .single();

    if (error || !service) {
      console.error('Update service error:', error);
      return res.status(404).json({ error: 'Service not found' });
    }

    res.json(service);
  } catch (err) {
    console.error('Update service error:', err);
    res.status(500).json({ error: 'Failed to update service' });
  }
});

// Delete (deactivate) a service
router.delete('/:id', authenticate, verifyBusinessOwner, async (req, res) => {
  try {
    const { id } = req.params;

    const { data: service, error } = await supabaseAdmin
      .from('services')
      .update({ is_active: false })
      .eq('id', id)
      .eq('business_id', req.businessId)
      .select()
      .single();

    if (error || !service) {
      console.error('Delete service error:', error);
      return res.status(404).json({ error: 'Service not found' });
    }

    res.json({ message: 'Service deactivated successfully' });
  } catch (err) {
    console.error('Delete service error:', err);
    res.status(500).json({ error: 'Failed to delete service' });
  }
});

module.exports = router;
