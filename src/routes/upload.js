const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const jwt = require('jsonwebtoken');

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

// Upload single image
router.post('/image', authenticate, upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded' });
    }

    // Return base64 data URL for serverless compatibility
    const base64Data = req.file.buffer.toString('base64');
    const imageUrl = `data:${req.file.mimetype};base64,${base64Data}`;

    res.json({
      success: true,
      url: imageUrl,
      filename: req.file.originalname,
      originalName: req.file.originalname,
      size: req.file.size
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message || 'Failed to upload image' });
  }
});

// Upload multiple images
router.post('/images', authenticate, upload.array('images', 10), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No images uploaded' });
    }

    const images = req.files.map(file => {
      const base64Data = file.buffer.toString('base64');
      const imageUrl = `data:${file.mimetype};base64,${base64Data}`;

      return {
        url: imageUrl,
        filename: file.originalname,
        originalName: file.originalname,
        size: file.size
      };
    });

    res.json({
      success: true,
      images: images
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message || 'Failed to upload images' });
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