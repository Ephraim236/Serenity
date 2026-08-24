const express = require('express');
const router = express.Router();
const { supabase, supabaseAdmin } = require('../config/supabase');
const { authenticate } = require('../middleware/auth');
const { sendClientBookingConfirmation, sendBusinessOwnerNotification, sendBookingApprovedNotification } = require('../services/emailService');

// Create a new appointment (booking)
router.post('/appointments', authenticate, async (req, res) => {
  try {
    const { service, serviceId, specialist, date, time, price, notes, clientName, clientEmail, clientPhone, businessId } = req.body;
    
    if (!businessId) {
      return res.status(400).json({ error: 'Business ID is required' });
    }

    // Verify business exists
    const { data: business } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', businessId)
      .eq('role', 'business')
      .single();

    if (!business) {
      return res.status(400).json({ error: 'Invalid business' });
    }

    const { data: appointment, error } = await supabaseAdmin
      .from('appointments')
      .insert({
        user_id: req.user.id,
        business_id: businessId,
        service,
        service_id: serviceId || null,
        specialist,
        date: new Date(date).toISOString().split('T')[0],
        time,
        price: parseFloat(price) || 0,
        notes,
        client_name: clientName,
        client_email: clientEmail,
        client_phone: clientPhone,
        status: 'pending'
      })
      .select()
      .single();

    if (error) {
      console.error('Create appointment error:', error);
      return res.status(500).json({ error: 'Failed to create appointment' });
    }

    // Send confirmation emails asynchronously
    sendClientBookingConfirmation(appointment).catch(err => 
      console.error('Failed to send client confirmation email:', err)
    );
    sendBusinessOwnerNotification(appointment).catch(err => 
      console.error('Failed to send business owner notification:', err)
    );
    
    res.status(201).json({
      message: 'Booking created successfully',
      appointment: {
        id: appointment.id,
        service,
        specialist,
        date,
        time,
        price: parseFloat(price) || 0,
        clientName,
        clientEmail,
        clientPhone,
        status: 'pending'
      }
    });
  } catch (err) {
    console.error('Create appointment error:', err);
    res.status(500).json({ error: 'Failed to create appointment' });
  }
});

// Get dashboard stats
router.get('/stats', authenticate, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayStr = today.toISOString().split('T')[0];
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    // Get counts
    const { count: totalClients } = await supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'client');

    const { count: totalAppointments } = await supabaseAdmin
      .from('appointments')
      .select('*', { count: 'exact', head: true });

    const { count: todayAppointments } = await supabaseAdmin
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .gte('date', todayStr)
      .lt('date', tomorrowStr);

    // Get total revenue from completed appointments
    const { data: revenueData } = await supabaseAdmin
      .from('appointments')
      .select('price')
      .eq('status', 'completed');

    const totalRevenue = revenueData?.reduce((sum, apt) => sum + (apt.price || 0), 0) || 0;

    // Get recent appointments
    const { data: recentAppointments } = await supabaseAdmin
      .from('appointments')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    // Calculate growth
    const lastMonth = new Date(today);
    lastMonth.setMonth(lastMonth.getMonth() - 1);

    const { count: lastMonthCount } = await supabaseAdmin
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .lt('created_at', lastMonth.toISOString());

    const { count: currentMonthCount } = await supabaseAdmin
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', lastMonth.toISOString());

    const growth = lastMonthCount > 0 
      ? ((currentMonthCount - lastMonthCount) / lastMonthCount * 100).toFixed(1)
      : 0;

    res.json({
      stats: {
        totalRevenue: totalRevenue.toFixed(2),
        totalAppointments: totalAppointments || 0,
        activeClients: totalClients || 0,
        todayAppointments: todayAppointments || 0,
        growth: parseFloat(growth)
      },
      recentAppointments: recentAppointments || []
    });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// Get revenue data for charts
router.get('/revenue', authenticate, async (req, res) => {
  try {
    const { period = '7' } = req.query;
    const days = parseInt(period);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];

    const { data: appointments } = await supabaseAdmin
      .from('appointments')
      .select('date, price')
      .eq('status', 'completed')
      .gte('date', startDateStr);

    // Group by date
    const revenueMap = new Map();
    for (let i = 0; i < days; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      revenueMap.set(d.toISOString().split('T')[0], 0);
    }

    (appointments || []).forEach(apt => {
      const dateStr = apt.date;
      if (revenueMap.has(dateStr)) {
        revenueMap.set(dateStr, revenueMap.get(dateStr) + (apt.price || 0));
      }
    });

    const formatted = Array.from(revenueMap.entries()).reverse().map(([date, revenue]) => ({
      name: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
      revenue
    }));

    res.json(formatted);
  } catch (err) {
    console.error('Revenue error:', err);
    res.json([]);
  }
});

// Get staff utilization (returns static data for now)
router.get('/staff', authenticate, async (req, res) => {
  try {
    res.json([
      { name: 'Sarah J.', role: 'Skin', value: 85 },
      { name: 'Michael C.', role: 'Massage', value: 65 },
      { name: 'Emma W.', role: 'Hair', value: 92 },
      { name: 'David L.', role: 'Nails', value: 45 }
    ]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch staff data' });
  }
});

// Get today's appointments
router.get('/appointments/today', authenticate, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    const { data: appointments } = await supabaseAdmin
      .from('appointments')
      .select('*')
      .eq('date', todayStr)
      .order('time', { ascending: true });

    res.json(appointments || []);
  } catch (err) {
    res.json([]);
  }
});

// Get all appointments
router.get('/appointments/all', authenticate, async (req, res) => {
  try {
    const { data: appointments } = await supabaseAdmin
      .from('appointments')
      .select('*')
      .order('date', { ascending: false })
      .order('time', { ascending: true });

    res.json(appointments || []);
  } catch (err) {
    res.json([]);
  }
});

// Get appointments by client email
router.get('/appointments/client', authenticate, async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.json([]);
    }

    const { data: appointments } = await supabaseAdmin
      .from('appointments')
      .select('*')
      .eq('client_email', email)
      .order('date', { ascending: false })
      .order('time', { ascending: true });

    res.json(appointments || []);
  } catch (err) {
    res.json([]);
  }
});

// Get appointments by date
router.get('/appointments/by-date', authenticate, async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res.json([]);
    }

    const startDate = new Date(date + 'T00:00:00');
    const endDate = new Date(date + 'T23:59:59');

    const { data: appointments } = await supabaseAdmin
      .from('appointments')
      .select('*')
      .gte('date', startDate.toISOString().split('T')[0])
      .lte('date', endDate.toISOString().split('T')[0])
      .order('time', { ascending: true });

    res.json(appointments || []);
  } catch (err) {
    console.error('Error fetching appointments by date:', err);
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

// Get booked appointments by business and date
router.get('/appointments/booked', authenticate, async (req, res) => {
  try {
    const { businessId, date } = req.query;
    
    if (!businessId || !date) {
      return res.json([]);
    }

    const dateStr = new Date(date + 'T00:00:00').toISOString().split('T')[0];

    const { data: appointments } = await supabaseAdmin
      .from('appointments')
      .select('time, status')
      .eq('business_id', businessId)
      .eq('date', dateStr)
      .in('status', ['pending', 'confirmed']);

    res.json(appointments || []);
  } catch (err) {
    console.error('Error fetching booked slots:', err);
    res.status(500).json({ error: 'Failed to fetch booked slots' });
  }
});

// Update appointment status
router.patch('/appointments/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const { data: appointment, error } = await supabaseAdmin
      .from('appointments')
      .update({ status, updated_at: new Date() })
      .eq('id', id)
      .select()
      .single();

    if (error || !appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Send email notification if booking is approved
    if (status === 'confirmed') {
      sendBookingApprovedNotification(appointment).catch(err => 
        console.error('Failed to send confirmation email:', err)
      );
    }

    res.json(appointment);
  } catch (err) {
    console.error('Update appointment error:', err);
    res.status(500).json({ error: 'Failed to update appointment' });
  }
});

// Delete appointment
router.delete('/appointments/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabaseAdmin
      .from('appointments')
      .delete()
      .eq('id', id);

    if (error) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    res.json({ message: 'Appointment deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete appointment' });
  }
});

// Get all services
router.get('/services', authenticate, async (req, res) => {
  try {
    const { data: services } = await supabaseAdmin
      .from('services')
      .select('id, name, description, category, duration, price, image, average_rating, review_count, business_name')
      .eq('is_active', true);

    res.json(services || []);
  } catch (err) {
    console.error('Error fetching services:', err);
    res.status(500).json({ error: 'Failed to fetch services' });
  }
});

module.exports = router;
