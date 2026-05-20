const mongoose = require('mongoose');
const Service = require('../src/models/Service');
const User = require('../src/models/User');

const migrate = async () => {
  try {
    // Connect to MongoDB
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/booking';
    await mongoose.connect(mongoURI);
    console.log('Connected to MongoDB');

    // Find all services
    const services = await Service.find({});
    console.log(`Found ${services.length} services to update`);

    let updatedCount = 0;
    let errorCount = 0;

    for (const service of services) {
      try {
        if (!service.business) {
          console.log(`Service ${service._id} has no business reference, skipping`);
          errorCount++;
          continue;
        }

        const business = await User.findById(service.business).select('businessName');
        if (business && business.businessName) {
          service.businessName = business.businessName;
          await service.save();
          updatedCount++;
          console.log(`Updated service "${service.name}" with businessName "${business.businessName}"`);
        } else {
          console.log(`Business not found or has no businessName for service ${service._id}`);
          errorCount++;
        }
      } catch (err) {
        console.error(`Error updating service ${service._id}:`, err.message);
        errorCount++;
      }
    }

    console.log('\n=== Migration Complete ===');
    console.log(`Successfully updated: ${updatedCount}`);
    console.log(`Errors/Skipped: ${errorCount}`);
    console.log(`Total services: ${services.length}`);

    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
};

migrate();
