const express = require('express');
const router = express.Router();

// Knowledge base for the chatbot
const knowledgeBase = {
  // Booking related questions
  'book': `To book an appointment:
1. Click on "Book Now" in the navigation
2. Select your desired service
3. Choose a specialist (optional)
4. Pick a date and time that works for you
5. Confirm your booking

You'll receive an email confirmation once your booking is submitted.`,
  
  'appointment': `To make an appointment:
1. Go to the "Book Now" page
2. Choose from our wide range of services (Spa, Hair, Nails, etc.)
3. Select your preferred specialist
4. Choose a convenient date and time
5. Confirm your booking

You'll get an email confirmation right away!`,

  'cancel': `To cancel or reschedule your booking:
1. Go to "My Bookings" in the navigation
2. Find your booking
3. Contact us at least 24 hours before your appointment

Please note that cancellations should be made at least 24 hours in advance.`,

  'reschedule': `To reschedule your appointment:
1. Go to "My Bookings" 
2. Find the booking you want to change
3. Contact our team to request a new time

We recommend rescheduling at least 24 hours before your original appointment.`,

  // Services
  'service': `We offer a variety of services:
• Spa Treatments: Luxury Facial, Deep Tissue Massage, Hot Stone Therapy, Aromatherapy
• Men's Grooming: Classic Haircut, Beard Trim, Hot Towel Shave
• Female Makeover: Hair Styling, Manicure & Pedicure, Bridal Makeup

Prices vary by service. Check our booking page for details!`,
  
  'price': `Our services range in price:
• Men's Grooming: ₵150 - ₵250
• Spa Services: ₵850 - ₵1,400
• Female Makeover: ₵300 - ₵2,500

Exact prices are shown when you select your service during booking.`,

  'cost': `Our services range in price:
• Men's Grooming: ₵150 - ₵250
• Spa Services: ₵850 - ₵1,400
• Female Makeover: ₵300 - ₵2,500

Exact prices are shown when you select your service during booking.`,

  // Hours and Location
  'hour': `We're open:
• Monday - Saturday: 9:00 AM - 6:00 PM
• Sunday: Closed

Our last appointment is at 5:00 PM.`,

  'time': `We're open:
• Monday - Saturday: 9:00 AM - 6:00 PM
• Sunday: Closed

Appointments are available from 9:00 AM to 5:00 PM.`,

  'location': `Serenity Salon is located in Accra, Ghana. Visit our booking page to see our address and directions.

We're easily accessible and have ample parking available.`,

  'address': `Serenity Salon is located in Accra, Ghana. Visit our booking page for more details on our location.`,

  // Contact
  'contact': `You can reach us:
• Through this chat (I'm here to help!)
• By visiting our contact page
• In person at our salon

We're happy to answer any questions you have!`,

  'phone': `You can call us during business hours. Visit our booking page for contact information.

We're here to help with any questions!`,

  'email': `You can email us at info@serenitysalon.com. We typically respond within 24 hours.

For immediate assistance, use our AI chat!`,

  // Account and Login
  'login': `To log in:
1. Click "Login" in the top navigation
2. Enter your email and password
3. Or use Google OAuth for quick access

If you're a business owner, you'll be redirected to the admin panel.`,

  'signup': `To create an account:
1. Click "Sign Up" in the navigation
2. Choose your account type (Client or Business)
3. Fill in your details
4. Verify your email

You can also sign up using your Google account!`,

  'account': `To create an account:
1. Click "Sign Up" in the navigation
2. Choose "Client" for regular bookings or "Business" if you own a salon
3. Fill in your details

Having an account lets you track your bookings and get exclusive offers!`,

  'password': `For password issues:
1. Use the "Forgot Password" link on the login page
2. Enter your email address
3. Check your inbox for reset instructions

If you signed up with Google, you can log in using that method instead.`,

  // Admin
  'admin': `The admin panel is for business owners to manage:
• Appointments (view, approve, cancel)
• Services (add, edit, remove)
• Customer bookings

Business owners can access it from the "Admin Portal" link.`,

  'business': `To manage a salon business:
1. Sign up as a "Business" account
2. Access the Admin Portal
3. Add your services and staff
4. Manage appointments from the dashboard

Contact support if you need help setting up your business profile.`,

  // General
  'hello': `Hello! 👋 Welcome to Serenity Salon! 

I'm here to help you with:
• Booking appointments
• Information about our services
• Account questions
• And more!

What would you like to know?`,

  'hi': `Hi there! 👋 Welcome to Serenity Salon!

How can I help you today? You can ask me about:
• Booking an appointment
• Our services and prices
• Opening hours
• Account help
• And more!`,

  'help': `I'm here to help! You can ask me about:
• 📅 Booking appointments
• 💆 Our services and treatments
• 💰 Prices and payment
• ⏰ Opening hours
• 📍 Our location
• 🔐 Account and login
• And anything else about Serenity Salon!

What would you like to know?`,

  'thank': `You're welcome! 😊 

Is there anything else I can help you with? Feel free to ask any questions about our services, booking, or anything else!`,

  'thanks': `You're welcome! 😊 

Is there anything else I can help you with? Feel free to ask any questions about our services, booking, or anything else!`,

  'bye': `Goodbye! 👋 

Thank you for chatting with Serenity Salon. We look forward to seeing you soon!

Remember: You can always book an appointment online 24/7!`,

  'greeting': `Hello! 👋 Welcome to Serenity Salon!

I'm your AI assistant and I'm here to help you with:
• 📅 Booking appointments
• 💆 Information about our services
• 💰 Pricing
• ⏰ Opening hours
• 🔐 Account help

What would you like to know?`
};

// Simple response generation
const generateResponse = (message) => {
  const lowerMessage = message.toLowerCase();
  
  // Check for exact matches first
  for (const [key, value] of Object.entries(knowledgeBase)) {
    if (lowerMessage.includes(key)) {
      return value;
    }
  }
  
  // Default response for unmatched queries
  return `I'm not sure I understand "${message}". 

However, I'm here to help! You can ask me about:
• 📅 Booking appointments
• 💆 Our services
• 💰 Prices
• ⏰ Opening hours
• 🔐 Account issues

Or you can contact our team directly for more specific questions.`;
};

// Chat endpoint
router.post('/message', async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    // Simulate AI processing delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const response = generateResponse(message);
    
    res.json({ 
      response,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Chatbot error:', error);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

// Get quick actions
router.get('/quick-actions', (req, res) => {
  res.json({
    actions: [
      { label: 'Book Appointment', action: 'book' },
      { label: 'View Services', action: 'services' },
      { label: 'Pricing', action: 'prices' },
      { label: 'Opening Hours', action: 'hours' },
      { label: 'Contact Info', action: 'contact' },
      { label: 'Login Help', action: 'login' }
    ]
  });
});

module.exports = router;
