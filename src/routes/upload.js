const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const jwt = require('jsonwebtoken');
const cloudinary = require('../config/cloudinary');
const { Readable } = require('stream');

// Configure multer for image uploads (use memory storage for serverless)
const storage = multer.memoryStorage();

// Filter to only allow image files
const fileFilter = (req, file, cb) => {
  const allowedExtensions = /jpeg|jpg|png|gif|webp/;
  const extname = allowedExtensions.test(path.extname(file.originalname).toLowerCase());
  const mimetype = file.mimetype.startsWith('image/');

  if (extname || mimetype) {
    return cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: fileFilter
});

// Middleware to verify JWT
const authenticate = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Helper function to upload to Cloudinary
const uploadToCloudinary = (buffer, filename, folder = 'booking') => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: folder,
        public_id: `${Date.now()}_${filename}`,
        resource_type: 'auto'
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      }
    );

    // Convert buffer to stream and upload
    const readable = Readable.from(buffer);
    readable.pipe(stream);
  });
};

// Upload single image
router.post('/image', authenticate, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded' });
    }

    // Check if Cloudinary is configured
    if (!process.env.CLOUDINARY_CLOUD_NAME) {
      console.warn('Cloudinary not configured, falling back to base64');
      const base64Data = req.file.buffer.toString('base64');
      const imageUrl = `data:${req.file.mimetype};base64,${base64Data}`;
      return res.json({
        success: true,
        url: imageUrl,
        filename: req.file.originalname,
        size: req.file.size,
        provider: 'base64'
      });
    }

    // Upload to Cloudinary
    const result = await uploadToCloudinary(
      req.file.buffer,
      req.file.originalname,
      'booking/images'
    );

    res.json({
      success: true,
      url: result.secure_url,
      publicId: result.public_id,
      filename: req.file.originalname,
      size: req.file.size,
      provider: 'cloudinary'
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message || 'Failed to upload image' });
  }
});

// Upload multiple images
router.post('/images', authenticate, upload.array('images', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No images uploaded' });
    }

    // Check if Cloudinary is configured
    if (!process.env.CLOUDINARY_CLOUD_NAME) {
      console.warn('Cloudinary not configured, falling back to base64');
      const images = req.files.map(file => {
        const base64Data = file.buffer.toString('base64');
        const imageUrl = `data:${file.mimetype};base64,${base64Data}`;
        return {
          url: imageUrl,
          filename: file.originalname,
          size: file.size,
          provider: 'base64'
        };
      });

      return res.json({
        success: true,
        images: images
      });
    }

    // Upload all images to Cloudinary in parallel
    const uploadPromises = req.files.map(file =>
      uploadToCloudinary(file.buffer, file.originalname, 'booking/images')
    );

    const results = await Promise.all(uploadPromises);

    const images = results.map((result, index) => ({
      url: result.secure_url,
      publicId: result.public_id,
      filename: req.files[index].originalname,
      size: req.files[index].size,
      provider: 'cloudinary'
    }));

    res.json({
      success: true,
      images: images
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message || 'Failed to upload images' });
  }
});

// Delete image from Cloudinary
router.delete('/image/:publicId', authenticate, async (req, res) => {
  try {
    const { publicId } = req.params;

    if (!publicId) {
      return res.status(400).json({ error: 'Public ID is required' });
    }

    // Check if Cloudinary is configured
    if (!process.env.CLOUDINARY_CLOUD_NAME) {
      return res.json({ success: true, message: 'Base64 images cannot be deleted' });
    }

    await cloudinary.uploader.destroy(publicId);

    res.json({
      success: true,
      message: 'Image deleted successfully'
    });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: err.message || 'Failed to delete image' });
  }
});

// Error handling for multer
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size too large. Maximum 5MB allowed.' });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
});

module.exports = router;