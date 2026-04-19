const express = require('express');
const router = express.Router();
const multer = require('multer');
const jwt = require('jsonwebtoken');

router.get('/health', (req, res) => {
  res.json({
    status: 'upload route working',
    cloudinary: !!cloudinary,
    timestamp: new Date().toISOString()
  });
});

let upload;
let cloudinary;

try {
  const { CloudinaryStorage } = require('multer-storage-cloudinary');
  cloudinary = require('cloudinary').v2;

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });

  const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: 'serenity-booking',
      allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
      transformation: [{ width: 1200, height: 1200, crop: 'limit' }]
    }
  });

  upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }
  });
} catch (err) {
  console.log('Cloudinary not configured, using in-memory upload');
  upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }
  });
}

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
    return res.status(401).json({ error: 'Invalid token' });
  }
};

router.post('/image', authenticate, upload.single('image'), (req, res) => {
  console.log('Upload route hit:', req.file ? 'file present' : 'no file');
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded' });
    }

    let url = req.file.path;
    if (!url && req.file.buffer) {
      url = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    }

    console.log('Upload successful, returning:', { url: url.substring(0, 50) + '...' });

    res.json({
      success: true,
      url: url,
      filename: req.file.originalname,
      originalName: req.file.originalname,
      size: req.file.size
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

router.post('/images', authenticate, upload.array('images', 10), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No images uploaded' });
    }
    const images = req.files.map(file => ({
      url: file.path || `data:${file.mimetype};base64,${file.buffer.toString('base64')}`,
      filename: file.originalname,
      originalName: file.originalname,
      size: file.size
    }));
    res.json({ success: true, images });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Failed to upload images' });
  }
});

module.exports = router;