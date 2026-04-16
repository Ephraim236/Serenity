const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const jwt = require('jsonwebtoken');

// Check if Vercel Blob token is available (production on Vercel)
const useBlobStorage = process.env.BLOB_READ_WRITE_TOKEN && process.env.BLOB_READ_WRITE_TOKEN !== 'your-vercel-blob-token-here';

console.log('[Upload Route] Initializing with useBlobStorage:', useBlobStorage);
if (useBlobStorage) {
  console.log('[Upload Route] BLOB_READ_WRITE_TOKEN length:', process.env.BLOB_READ_WRITE_TOKEN?.length || 0);
}

// Configure multer
let upload;

if (useBlobStorage) {
  // Use memory storage for Vercel Blob upload (files stored in memory as buffers)
  const storage = multer.memoryStorage();
  
  const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  };

  upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: fileFilter
  });
} else {
  // Fallback to disk storage for local development
  const fs = require('fs');
  const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
  
  try {
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
  } catch (err) {
    console.log('Skipping uploads directory creation');
  }

  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
    }
  });

  const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  };

  upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: fileFilter
  });
}

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

// Upload single image
router.post('/image', authenticate, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded' });
    }

    console.log('Processing image upload:', {
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype
    });

    let imageUrl, filename, originalName, size;

    if (useBlobStorage) {
      // Use Vercel Blob SDK with dynamic import (handles both public and private stores)
      let blob;
      try {
        blob = await import('@vercel/blob');
        console.log('Vercel Blob SDK loaded');
      } catch (e) {
        console.error('Failed to load @vercel/blob:', e);
        throw new Error('Blob storage SDK not available');
      }

      const timestamp = Date.now();
      const randomSuffix = Math.round(Math.random() * 1E9);
      const extname = path.extname(req.file.originalname);
      const blobPathname = `uploads/${timestamp}-${randomSuffix}${extname}`;

      console.log('Uploading to Vercel Blob:', blobPathname);
      
      // The SDK will automatically use store's configured access level
      // (public store → public URL; private store → signed URL)
      const blobResult = await blob.put(blobPathname, req.file.buffer, {
        contentType: req.file.mimetype
      });

      console.log('Blob upload result:', JSON.stringify(blobResult, null, 2));
      
      imageUrl = blobResult.url;
      filename = blobPathname;
      originalName = req.file.originalname;
      size = req.file.size;
      console.log('Upload successful:', imageUrl);
    } else {
      // Local development - file already saved to disk
      imageUrl = `/uploads/${req.file.filename}`;
      filename = req.file.filename;
      originalName = req.file.originalname;
      size = req.file.size;
    }
    
    res.json({
      success: true,
      url: imageUrl,
      filename: filename,
      originalName: originalName,
      size: size
    });
  } catch (err) {
    console.error('Upload error:', err);
    console.error('Error stack:', err.stack);
    
    let userMessage = 'Failed to upload image';
    if (err.message.includes('private store')) {
      userMessage = 'Storage access misconfigured. Please contact support.';
    } else if (err.message.includes('ENOTFOUND') || err.message.includes('EAI_AGAIN')) {
      userMessage = 'Network error. Please check your connection.';
    }
    
    res.status(500).json({ 
      error: userMessage,
      message: err.message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
  }
});

// Upload multiple images
router.post('/images', authenticate, upload.array('images', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No images uploaded' });
    }

    let images;

    if (useBlobStorage) {
      // Load SDK once
      const blob = await import('@vercel/blob');
      
      // Upload all files to Vercel Blob storage in parallel
      const uploadPromises = req.files.map(async (file) => {
        const timestamp = Date.now();
        const randomSuffix = Math.round(Math.random() * 1E9);
        const extname = path.extname(file.originalname);
        const blobPathname = `uploads/${timestamp}-${randomSuffix}${extname}`;

        const blobResult = await blob.put(blobPathname, file.buffer, {
          contentType: file.mimetype
        });

        return {
          url: blobResult.url,
          filename: blobPathname,
          originalName: file.originalname,
          size: file.size
        };
      });

      images = await Promise.all(uploadPromises);
    } else {
      // Local development - files already saved to disk
      images = req.files.map(file => ({
        url: `/uploads/${file.filename}`,
        filename: file.filename,
        originalName: file.originalname,
        size: file.size
      }));
    }
    
    res.json({
      success: true,
      images: images
    });
  } catch (err) {
    console.error('Multiple images upload error:', err);
    
    let userMessage = 'Failed to upload images';
    if (err.message.includes('private store')) {
      userMessage = 'Storage access misconfigured. Please contact support.';
    }
    
    res.status(500).json({ 
      error: userMessage,
      message: err.message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
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
