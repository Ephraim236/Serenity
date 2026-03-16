const nodemailer = require('nodemailer');
const cron = require('node-cron');
const Appointment = require('../models/Appointment');
const User = require('../models/User');

// Create email transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER || 'serenitysalon2024@gmail.com',
      pass: process.env.EMAIL_PASS || 'your-app-password'
    }
  });
};

// Send email helper
const sendEmail = async (to, subject, html) => {
  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: process.env.EMAIL_USER || 'serenitysalon2024@gmail.com',
      to,
      subject,
      html
    });
    console.log(`Email sent to ${to}`);
    return true;
  } catch (error) {
    console.error('Email sending error:', error);
    return false;
  }
};

// Send booking confirmation to client
const sendClientBookingConfirmation = async (appointment) => {
  const subject = 'Booking Confirmation - Serenity Salon';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
        .detail-label { font-weight: bold; color: #667eea; }
        .footer { text-align: center; margin-top: 20px; color: #888; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✅ Booking Confirmed!</h1>
          <p>Thank you for booking with Serenity Salon</p>
        </div>
        <div class="content">
          <p>Dear <strong>${appointment.clientName}</strong>,</p>
          <p>Your booking has been successfully submitted and is currently pending approval. Here are your booking details:</p>
          
          <div class="details">
            <div class="detail-row">
              <span class="detail-label">Service:</span>
              <span>${appointment.service}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Specialist:</span>
              <span>${appointment.specialist}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Date:</span>
              <span>${new Date(appointment.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Time:</span>
              <span>${appointment.time}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Price:</span>
              <span>$${appointment.price}</span>
            </div>
            <div class="detail-row" style="border-bottom: none;">
              <span class="detail-label">Status:</span>
              <span style="color: #f59e0b; font-weight: bold;">Pending Approval</span>
            </div>
          </div>
          
          <p>📧 You'll receive another email once your booking is approved by our team.</p>
          <p>If you have any questions, feel free to contact us or use our AI chat assistant on the website.</p>
          
          <div class="footer">
            <p>© 2026 Serenity Salon. All rights reserved.</p>
            <p>Your relaxation, our priority.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
  
  return sendEmail(appointment.clientEmail, subject, html);
};

// Send booking notification to business owner
const sendBusinessOwnerNotification = async (appointment) => {
  // Find the business owner associated with this booking using the business field
  const businessOwner = await User.findOne({ _id: appointment.business, role: 'business' });
  
  if (!businessOwner) {
    console.log('No business owner found for this booking');
    return false;
  }
  
  const subject = '🔔 New Booking Request - Approval Required';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #fffbeb; padding: 30px; border-radius: 0 0 10px 10px; }
        .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
        .detail-label { font-weight: bold; color: #d97706; }
        .action-btn { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; margin-top: 15px; }
        .footer { text-align: center; margin-top: 20px; color: #888; font-size: 14px; }
        .urgent { color: #dc2626; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📋 New Booking Request!</h1>
          <p>Action required - Please approve or decline</p>
        </div>
        <div class="content">
          <p>Hello <strong>${businessOwner.name}</strong>,</p>
          <p class="urgent">⚡ A new booking requires your approval:</p>
          
          <div class="details">
            <div class="detail-row">
              <span class="detail-label">Client Name:</span>
              <span>${appointment.clientName}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Client Email:</span>
              <span>${appointment.clientEmail}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Client Phone:</span>
              <span>${appointment.clientPhone || 'Not provided'}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Service:</span>
              <span>${appointment.service}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Specialist:</span>
              <span>${appointment.specialist}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Date:</span>
              <span>${new Date(appointment.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Time:</span>
              <span>${appointment.time}</span>
            </div>
            <div class="detail-row" style="border-bottom: none;">
              <span class="detail-label">Price:</span>
              <span>${appointment.price}</span>
            </div>
          </div>
          
          <p>📝 Please log in to your admin dashboard to approve or decline this booking.</p>
          
          <div class="footer">
            <p>© 2026 Serenity Salon. Admin Panel</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
  
  return sendEmail(businessOwner.email, subject, html);
};

// Send booking approved notification to client
const sendBookingApprovedNotification = async (appointment) => {
  const subject = '🎉 Your Booking is Approved! - Serenity Salon';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f0fdf4; padding: 30px; border-radius: 0 0 10px 10px; }
        .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
        .detail-label { font-weight: bold; color: #10b981; }
        .footer { text-align: center; margin-top: 20px; color: #888; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✅ Booking Approved!</h1>
          <p>We're excited to see you!</p>
        </div>
        <div class="content">
          <p>Dear <strong>${appointment.clientName}</strong>,</p>
          <p>Great news! Your booking has been <strong>approved</strong>. Here are your confirmed details:</p>
          
          <div class="details">
            <div class="detail-row">
              <span class="detail-label">Service:</span>
              <span>${appointment.service}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Specialist:</span>
              <span>${appointment.specialist}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Date:</span>
              <span>${new Date(appointment.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Time:</span>
              <span>${appointment.time}</span>
            </div>
            <div class="detail-row" style="border-bottom: none;">
              <span class="detail-label">Price:</span>
              <span>$${appointment.price}</span>
            </div>
          </div>
          
          <p>📍 Please arrive 10 minutes before your scheduled time.</p>
          <p>If you need to reschedule or cancel, please contact us at least 24 hours in advance.</p>
          
          <div class="footer">
            <p>© 2026 Serenity Salon. All rights reserved.</p>
            <p>Your relaxation, our priority. 💆‍♀️</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
  
  return sendEmail(appointment.clientEmail, subject, html);
};

// Send reminder email to client
const sendClientReminder = async (appointment) => {
  const subject = '⏰ Reminder: Your Appointment is Tomorrow! - Serenity Salon';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #eff6ff; padding: 30px; border-radius: 0 0 10px 10px; }
        .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
        .detail-label { font-weight: bold; color: #3b82f6; }
        .footer { text-align: center; margin-top: 20px; color: #888; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>⏰ Appointment Reminder</h1>
          <p>Your appointment is tomorrow!</p>
        </div>
        <div class="content">
          <p>Dear <strong>${appointment.clientName}</strong>,</p>
          <p>This is a friendly reminder about your upcoming appointment:</p>
          
          <div class="details">
            <div class="detail-row">
              <span class="detail-label">Service:</span>
              <span>${appointment.service}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Specialist:</span>
              <span>${appointment.specialist}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Date:</span>
              <span>${new Date(appointment.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </div>
            <div class="detail-row" style="border-bottom: none;">
              <span class="detail-label">Time:</span>
              <span>${appointment.time}</span>
            </div>
          </div>
          
          <p>📍 Please arrive 10 minutes before your scheduled time.</p>
          <p>We look forward to seeing you!</p>
          
          <div class="footer">
            <p>© 2026 Serenity Salon. All rights reserved.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
  
  return sendEmail(appointment.clientEmail, subject, html);
};

// Send reminder email to business owner
const sendBusinessOwnerReminder = async (appointment) => {
  const businessOwner = await User.findOne({ _id: appointment.business, role: 'business' });
  
  if (!businessOwner) return false;
  
  const subject = '⏰ Tomorrow\'s Appointment Reminder';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f5f3ff; padding: 30px; border-radius: 0 0 10px 10px; }
        .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
        .detail-label { font-weight: bold; color: #8b5cf6; }
        .footer { text-align: center; margin-top: 20px; color: #888; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📅 Tomorrow's Schedule</h1>
          <p>You have an appointment booked</p>
        </div>
        <div class="content">
          <p>Hello <strong>${businessOwner.name}</strong>,</p>
          <p>Here's your tomorrow's appointment:</p>
          
          <div class="details">
            <div class="detail-row">
              <span class="detail-label">Client:</span>
              <span>${appointment.clientName}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Service:</span>
              <span>${appointment.service}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Time:</span>
              <span>${appointment.time}</span>
            </div>
            <div class="detail-row" style="border-bottom: none;">
              <span class="detail-label">Specialist:</span>
              <span>${appointment.specialist}</span>
            </div>
          </div>
          
          <div class="footer">
            <p>© 2026 Serenity Salon. Admin Panel</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
  
  return sendEmail(businessOwner.email, subject, html);
};

// Schedule reminder emails - runs every hour
const scheduleReminders = () => {
  console.log('⏰ Setting up appointment reminder scheduler...');
  
  // Check every hour for upcoming appointments
  cron.schedule('0 * * * *', async () => {
    console.log('🔍 Checking for upcoming appointments...');
    
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      
      const tomorrowEnd = new Date(tomorrow);
      tomorrowEnd.setHours(23, 59, 59, 999);
      
      // Find appointments for tomorrow that are confirmed
      const upcomingAppointments = await Appointment.find({
        date: { $gte: tomorrow, $lte: tomorrowEnd },
        status: 'confirmed',
        reminderSent: { $ne: true }
      });
      
      console.log(`Found ${upcomingAppointments.length} appointments for tomorrow`);
      
      for (const appointment of upcomingAppointments) {
        // Send reminder to client
        await sendClientReminder(appointment);
        
        // Send reminder to business owner
        await sendBusinessOwnerReminder(appointment);
        
        // Mark reminder as sent
        appointment.reminderSent = true;
        await appointment.save();
      }
    } catch (error) {
      console.error('Error sending reminders:', error);
    }
  });
};

module.exports = {
  sendEmail,
  sendClientBookingConfirmation,
  sendBusinessOwnerNotification,
  sendBookingApprovedNotification,
  sendClientReminder,
  sendBusinessOwnerReminder,
  scheduleReminders
};
