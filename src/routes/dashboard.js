const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Appointment = require('../models/Appointment');
const User = require('../models/User');
const Service = require('../models/Service');

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
    // Return demo data if database is not available
    res.json({
      stats: {
        totalRevenue: 12840,
        totalAppointments: 156,
        activeClients: 842,
        todayAppointments: 12,
        growth: 12.5
      },
      recentAppointments: [
        {
          _id: '1',
          clientName: 'Jessica Reed',
          service: 'Luxury Facial',
          time: '10:30 AM',
          status: 'confirmed',
          specialist: 'Sarah J.',
          date: new Date()
        },
        {
          _id: '2',
          clientName: 'Marcus Smith',
          service: 'Deep Tissue',
          time: '12:00 PM',
          status: 'pending',
          specialist: 'Michael C.',
          date: new Date()
        },
        {
          _id: '3',
          clientName: 'Elena Gilbert',
          service: 'Designer Haircut',
          time: '02:15 PM',
          status: 'in_progress',
          specialist: 'Emma W.',
          date: new Date()
        }
      ]
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
    // Return demo data
    res.json([
      { name: 'Mon', revenue: 4000 },
      { name: 'Tue', revenue: 3000 },
      { name: 'Wed', revenue: 5000 },
      { name: 'Thu', revenue: 2780 },
      { name: 'Fri', revenue: 6890 },
      { name: 'Sat', revenue: 8390 },
      { name: 'Sun', revenue: 4490 }
    ]);
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
    // Return demo data
    res.json([
      {
        _id: '1',
        clientName: 'Jessica Reed',
        service: 'Luxury Facial',
        time: '10:30 AM',
        status: 'confirmed',
        specialist: 'Sarah J.'
      },
      {
        _id: '2',
        clientName: 'Marcus Smith',
        service: 'Deep Tissue',
        time: '12:00 PM',
        status: 'pending',
        specialist: 'Michael C.'
      },
      {
        _id: '3',
        clientName: 'Elena Gilbert',
        service: 'Designer Haircut',
        time: '02:15 PM',
        status: 'in_progress',
        specialist: 'Emma W.'
      }
    ]);
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

    res.json(appointment);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update appointment' });
  }
});

// Get all services
router.get('/services', authenticate, async (req, res) => {
  try {
    const services = await Service.find({ isActive: true }).lean();
    res.json(services);
  } catch (err) {
    // Return demo data
    res.json([
      { _id: '1', name: 'Luxury Facial', category: 'skin', duration: 60, price: 150 },
      { _id: '2', name: 'Deep Tissue Massage', category: 'massage', duration: 90, price: 120 },
      { _id: '3', name: 'Designer Haircut', category: 'hair', duration: 45, price: 85 },
      { _id: '4', name: 'Full Spa Package', category: 'spa', duration: 180, price: 350 }
    ]);
  }
});

module.exports = router;
