const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Appointment = require('../models/Appointment');
const User = require('../models/User');
const Service = require('../models/Service');
const { sendClientBookingConfirmation, sendBusinessOwnerNotification, sendBookingApprovedNotification } = require('../services/emailService');

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

// Create a new appointment (booking)
router.post('/appointments', authenticate, async (req, res) => {
  try {
    const { service, specialist, date, time, price, notes, clientName, clientEmail, clientPhone, businessId } = req.body;
    
    if (!businessId) {
      return res.status(400).json({ error: 'Business ID is required' });
    }
    
    // Verify the business exists (or allow demo businesses)
    let business = null;
    try {
      business = await User.findOne({ _id: businessId, role: 'business' });
    } catch (e) {
      // MongoDB might not be connected, allow demo businesses
    }
    
    const demoBusinesses = ['demo-business-1', 'demo-business-2', 'demo-business-3'];
    if (!business && !demoBusinesses.includes(businessId)) {
      return res.status(400).json({ error: 'Invalid business' });
    }
    
    // Try to save to MongoDB if connected, otherwise return success
    try {
      const appointment = new Appointment({
        user: req.user.id,
        business: businessId,
        service,
        specialist,
        date: new Date(date),
        time,
        price: parseFloat(price) || 0,
        notes,
        clientName,
        clientEmail,
        clientPhone,
        status: 'pending'
      });
      
      await appointment.save();
      
      // Send confirmation email to client
      await sendClientBookingConfirmation(appointment);
      
      // Send notification to the specific business owner
      await sendBusinessOwnerNotification(appointment);
    } catch (dbError) {
      // MongoDB not connected, return demo success
      console.log('MongoDB not connected, booking saved in demo mode');
    }
    
    res.status(201).json({
      message: 'Booking created successfully',
      appointment: {
        _id: 'demo-' + Date.now(),
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
    // If user is business owner, get their specific stats
    // For demo, we'll aggregate all data
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get counts
    const totalClients = await User.countDocuments({ role: 'client' });
    const totalAppointments = await Appointment.countDocuments();
    const todayAppointments = await Appointment.countDocuments({
      date: { $gte: today, $lt: tomorrow }
    });

    // Calculate revenue (completed appointments)
    const revenueResult = await Appointment.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$price' } } }
    ]);
    const totalRevenue = revenueResult[0]?.total || 0;

    // Get recent appointments
    const recentAppointments = await Appointment.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    // Calculate growth (compare with previous month)
    const lastMonth = new Date(today);
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const lastMonthAppointments = await Appointment.countDocuments({
      createdAt: { $lt: lastMonth }
    });
    const currentMonthAppointments = await Appointment.countDocuments({
      createdAt: { $gte: lastMonth }
    });
    const growth = lastMonthAppointments > 0 
      ? ((currentMonthAppointments - lastMonthAppointments) / lastMonthAppointments * 100).toFixed(1)
      : 0;

    res.json({
      stats: {
        totalRevenue: totalRevenue.toFixed(2),
        totalAppointments,
        activeClients: totalClients,
        todayAppointments,
        growth: parseFloat(growth)
      },
      recentAppointments
    });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    // Return empty data if database is not available
    res.json({
      stats: {
        totalRevenue: 0,
        totalAppointments: 0,
        activeClients: 0,
        todayAppointments: 0,
        growth: 0
      },
      recentAppointments: []
    });
  }
});

// Get revenue data for charts
router.get('/revenue', authenticate, async (req, res) => {
  try {
    const { period = '7' } = req.query;
    const days = parseInt(period);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const revenueData = await Appointment.aggregate([
      {
        $match: {
          status: 'completed',
          date: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          revenue: { $sum: '$price' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Format for chart
    const formatted = revenueData.map(item => ({
      name: new Date(item._id).toLocaleDateString('en-US', { weekday: 'short' }),
      revenue: item.revenue
    }));

    res.json(formatted);
  } catch (err) {
    // Return empty data if database error
    res.json([]);
  }
});

// Get staff utilization
router.get('/staff', authenticate, async (req, res) => {
  try {
    // For demo, return sample staff data
    // In production, this would come from a Staff model
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
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const appointments = await Appointment.find({
      date: { $gte: today, $lt: tomorrow }
    }).sort({ time: 1 }).lean();

    res.json(appointments);
  } catch (err) {
    // Return empty data
    res.json([]);
  }
});

// Get all appointments
router.get('/appointments/all', authenticate, async (req, res) => {
  try {
    const appointments = await Appointment.find()
      .sort({ date: -1, time: 1 })
      .lean();

    res.json(appointments);
  } catch (err) {
    // Return empty data
    res.json([]);
  }
});

// Update appointment status
router.patch('/appointments/:id', authenticate, async (req, res) => {
  try {
    const { status } = req.body;
    const appointment = await Appointment.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Send email notification if booking is approved
    if (status === 'confirmed') {
      await sendBookingApprovedNotification(appointment);
    }

    res.json(appointment);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update appointment' });
  }
});

// Delete appointment
router.delete('/appointments/:id', authenticate, async (req, res) => {
  try {
    const appointment = await Appointment.findByIdAndDelete(req.params.id);

    if (!appointment) {
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
    const services = await Service.find({ isActive: true }).lean();
    res.json(services);
  } catch (err) {
    // Return empty array if database error
    res.json([]);
  }
});

module.exports = router;
