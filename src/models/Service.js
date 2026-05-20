const mongoose = require('mongoose');
const User = require('./User');

const serviceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String
  },
  category: {
    type: String,
    enum: ['hair', 'skin', 'massage', 'nails', 'spa'],
    required: true
  },
  duration: {
    type: Number, // in minutes
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  image: {
    type: String
  },
  isActive: {
    type: Boolean,
    default: true
  },
  business: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  businessName: {
    type: String,
    trim: true
  },
  // Service rating fields
  averageRating: {
    type: Number,
    min: 0,
    max: 5,
    default: 0
  },
  reviewCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Pre-save hook to populate businessName from referenced business
serviceSchema.pre('save', async function(next) {
  if (!this.business) return next();
  
  // Only fetch if businessName is not set or business reference changed
  if (this.isNew || this.isModified('business')) {
    try {
      const business = await User.findById(this.business).select('businessName');
      if (business && business.businessName) {
        this.businessName = business.businessName;
      } else {
        this.businessName = undefined;
      }
    } catch (err) {
      console.error('Error populating businessName:', err.message);
    }
  }
  next();
});

module.exports = mongoose.model('Service', serviceSchema);
