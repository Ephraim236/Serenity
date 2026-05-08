const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  business: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  service: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service'
  },
  appointment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment'
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  comment: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  // Tags for quick feedback
  tags: [{
    type: String,
    enum: ['excellent', 'professional', 'clean', 'friendly', 'worth_it', 'punctual', 'skilled', 'relaxing']
  }],
  // Verify that the user actually used the service
  isVerified: {
    type: Boolean,
    default: false
  },
  // Response from business owner
  businessResponse: {
    text: String,
    createdAt: Date
  }
}, {
  timestamps: true
});

// Compound index to ensure one review per user per service/business combination
reviewSchema.index({ user: 1, business: 1, service: 1 }, { unique: true, sparse: true });

// Index for querying business reviews
reviewSchema.index({ business: 1, createdAt: -1 });
reviewSchema.index({ service: 1, createdAt: -1 });
reviewSchema.index({ rating: 1 });

module.exports = mongoose.model('Review', reviewSchema);
