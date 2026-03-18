const express = require('express');
const router = express.Router();
const { sendEmail } = require('../services/emailService');

// Test email endpoint
router.post('/test', async (req, res) => {
  try {
    const { email, type } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email address is required' });
    }

    const testEmails = {
      // Test booking confirmation email to client
      confirmation: {
        subject: '🧪 Test: Booking Confirmation - Serenity Salon',
        html: `
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
                <h1>✅ Test Email</h1>
                <p>This is a test booking confirmation</p>
              </div>
              <div class="content">
                <p>Dear <strong>Test User</strong>,</p>
                <p>This is a test email to verify the email system is working correctly.</p>
                
                <div class="details">
                  <div class="detail-row">
                    <span class="detail-label">Service:</span>
                    <span>Luxury Facial</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Specialist:</span>
                    <span>Sarah Johnson</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Date:</span>
                    <span>March 20, 2026</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Time:</span>
                    <span>10:00 AM</span>
                  </div>
                  <div class="detail-row" style="border-bottom: none;">
                    <span class="detail-label">Status:</span>
                    <span style="color: #f59e0b; font-weight: bold;">Pending Approval</span>
                  </div>
                </div>
                
                <p>This is a test email - no actual booking has been made.</p>
                
                <div class="footer">
                  <p>© 2026 Serenity Salon. All rights reserved.</p>
                </div>
              </div>
            </div>
          </body>
          </html>
        `
      },
      
      // Test booking approved email
      approved: {
        subject: '🧪 Test: Booking Approved - Serenity Salon',
        html: `
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
                <h1>✅ Test: Booking Approved!</h1>
                <p>This is a test approval email</p>
              </div>
              <div class="content">
                <p>Dear <strong>Test User</strong>,</p>
                <p>This is a test email to verify the booking approved notification is working.</p>
                
                <div class="details">
                  <div class="detail-row">
                    <span class="detail-label">Service:</span>
                    <span>Deep Tissue Massage</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Date:</span>
                    <span>March 20, 2026</span>
                  </div>
                  <div class="detail-row" style="border-bottom: none;">
                    <span class="detail-label">Time:</span>
                    <span>2:00 PM</span>
                  </div>
                </div>
                
                <p>This is a test email - no actual booking has been approved.</p>
                
                <div class="footer">
                  <p>© 2026 Serenity Salon. All rights reserved.</p>
                </div>
              </div>
            </div>
          </body>
          </html>
        `
      },
      
      // Test reminder email
      reminder: {
        subject: '🧪 Test: Appointment Reminder - Serenity Salon',
        html: `
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
                <h1>⏰ Test: Appointment Reminder</h1>
                <p>This is a test reminder email</p>
              </div>
              <div class="content">
                <p>Dear <strong>Test User</strong>,</p>
                <p>This is a test email to verify the reminder system is working.</p>
                
                <div class="details">
                  <div class="detail-row">
                    <span class="detail-label">Service:</span>
                    <span>Hot Stone Therapy</span>
                  </div>
                  <div class="detail-row" style="border-bottom: none;">
                    <span class="detail-label">Time:</span>
                    <span>3:00 PM</span>
                  </div>
                </div>
                
                <p>This is a test email - no actual appointment reminder.</p>
                
                <div class="footer">
                  <p>© 2026 Serenity Salon. All rights reserved.</p>
                </div>
              </div>
            </div>
          </body>
          </html>
        `
      }
    };

    // Default to confirmation if type not specified
    const emailTemplate = testEmails[type] || testEmails.confirmation;
    
    const success = await sendEmail(email, emailTemplate.subject, emailTemplate.html);
    
    if (success) {
      res.json({ 
        success: true, 
        message: `Test ${type || 'confirmation'} email sent to ${email}` 
      });
    } else {
      res.status(500).json({ 
        success: false, 
        error: 'Failed to send test email. Check server console for details.' 
      });
    }
  } catch (error) {
    console.error('Test email error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Simple ping test - just checks if email config works
router.get('/ping', async (req, res) => {
  try {
    const { sendEmail } = require('../services/emailService');
    
    // Try to get transporter info without sending
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER || 'serenitysalon2024@gmail.com',
        pass: process.env.EMAIL_PASS || 'your-app-password'
      }
    });
    
    // Verify connection
    await transporter.verify();
    
    res.json({ 
      success: true, 
      message: 'Email configuration is valid!',
      email: process.env.EMAIL_USER || 'serenitysalon2024@gmail.com'
    });
  } catch (error) {
    console.error('Email ping error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      hint: 'Make sure EMAIL_USER and EMAIL_PASS are set in .env file'
    });
  }
});

module.exports = router;
