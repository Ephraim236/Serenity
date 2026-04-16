const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../config/environment');

// Generate unique filename with content hash for deduplication
const generateFilename = (originalname, buffer) => {
  const ext = path.extname(originalname);
  const hash = crypto.createHash('sha256').update(buffer).digest('hex').substring(0, 16);
  const timestamp = Date.now();
  return `${timestamp}-${hash}${ext}`;
};

// Image validation with magic bytes
const validateImageBuffer = (buffer, mimetype) => {
  const signatures = {
    'image/jpeg': [0xFF, 0xD8, 0xFF],
    'image/jpg': [0xFF, 0xD8, 0xFF],
    'image/png': [0x89, 0x50, 0x4E, 0x47],
    'image/gif': [0x47, 0x49, 0x46, 0x38, 0x37, 0x61], // GIF87a
    'image/webp': [0x52, 0x49, 0x46, 0x46] // RIFF
  };
  
  const expected = signatures[mimetype];
  if (!expected) return false;
  
  for (let i = 0; i < expected.length; i++) {
    if (buffer[i] !== expected[i]) return false;
  }
  return true;
};

// Configure multer
let upload;

if (config.useBlobStorage) {
  console.log('📦 Upload: Using Vercel Blob storage');
  
  const storage = multer.memoryStorage();
  
  const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (!extname || !mimetype) {
      return cb(new Error('Only image files (JPEG, PNG, GIF, WEBP) are allowed'), false);
    }
    cb(null, true);
  };
  
  upload = multer({
    storage,
    limits: { 
      fileSize: 5 * 1024 * 1024, // 5MB
      files: 10
    },
    fileFilter
  });
} else {
  console.log('💾 Upload: Using local disk storage (development only)');
  
  const fs = require('fs');
  const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
  
  try {
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
  } catch (err) {
    console.log('⚠️  Uploads directory unavailable:', err.message);
  }

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
      const unique = generateFilename(file.originalname, file.buffer);
      cb(null, unique);
    }
  });

  const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (!extname || !mimetype) {
      return cb(new Error('Only image files (JPEG, PNG, GIF, WEBP) are allowed'), false);
    }
    cb(null, true);
  };

  upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024, files: 10 },
    fileFilter
  });
}

// JWT Authentication middleware
const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const token = authHeader.substring(7).trim();
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const decoded = jwt.verify(token, config.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Upload single image
router.post('/image', authenticate, upload.single('image'), async (req, res) => {
  const requestId = crypto.randomUUID();
  
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    // Validate magic bytes to prevent MIME spoofing
    if (!validateImageBuffer(req.file.buffer, req.file.mimetype)) {
      console.warn(`[${requestId}] Invalid image magic bytes:`, {
        originalname: req.file.originalname,
        mimetype: req.file.mimetype
      });
      return res.status(400).json({ 
        error: 'Invalid image file format. Only JPEG, PNG, GIF, WEBP allowed.' 
      });
    }

    let imageUrl, filename;
    
    if (config.useBlobStorage) {
      // Vercel Blob storage
      let blobModule;
      try {
        blobModule = await import('@vercel/blob');
      } catch (e) {
        console.error(`[${requestId}] Failed to import @vercel/blob:`, e);
        throw new Error('Storage service unavailable');
      }
      
      // Handle both default and named export
      const blob = blobModule.default || blobModule;
      if (!blob || !blob.put) {
        throw new Error('Invalid blob storage module');
      }
      
      const uniqueName = generateFilename(req.file.originalname, req.file.buffer);
      const blobPath = `uploads/${uniqueName}`;
      
      console.log(`[${requestId}] Uploading to Vercel Blob:`, {
        path: blobPath,
        size: req.file.size,
        type: req.file.mimetype
      });
      
      const blobResult = await blob.put(blobPath, req.file.buffer, {
        access: 'public'
      });
      
      imageUrl = blobResult.url;
      filename = blobPath;
      console.log(`[${requestId}] ✅ Upload success: ${imageUrl}`);
    } else {
      // Local development
      filename = req.file.filename;
      imageUrl = `/uploads/${req.file.filename}`;
      console.log(`[${requestId}] 💾 Saved locally: ${imageUrl}`);
    }
    
    res.json({
      success: true,
      url: imageUrl,
      filename,
      originalName: req.file.originalname,
      size: req.file.size,
      mimeType: req.file.mimetype
    });
    
  } catch (err) {
    console.error(`[${requestId}] ❌ Upload error:`, {
      error: err.message,
      code: err.code,
      stack: config.isProduction ? undefined : err.stack
    });
    
    let status = 500;
    let userMessage = 'Failed to upload image';
    
    if (err.code === 'LIMIT_FILE_SIZE') {
      status = 400;
      userMessage = 'File too large. Maximum 5MB allowed.';
    } else if (err.message.includes('private store')) {
      userMessage = 'Storage access misconfigured. Please contact support.';
    } else if (err.message.includes('ENOTFOUND') || err.message.includes('EAI_AGAIN')) {
      status = 503;
      userMessage = 'Network error. Please check your connection and retry.';
    } else if (err.message.includes('Storage service unavailable')) {
      status = 503;
      userMessage = 'Storage service temporarily unavailable.';
    } else if (err.message.includes('Invalid image file')) {
      status = 400;
      userMessage = err.message;
    }
    
    res.status(status).json({ 
      error: userMessage,
      requestId
    });
  }
});

// Upload multiple images
router.post('/images', authenticate, upload.array('images', 10), async (req, res) => {
  const requestId = crypto.randomUUID();
  
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No images uploaded' });
    }
    
    console.log(`[${requestId}] Multiple upload: user=${req.user.id}, count=${req.files.length}`);
    
    // Validate all files first
    for (const file of req.files) {
      if (!validateImageBuffer(file.buffer, file.mimetype)) {
        return res.status(400).json({ 
          error: `Invalid image file: ${file.originalname}` 
        });
      }
    }
    
    let images;
    
    if (config.useBlobStorage) {
      const blobModule = await import('@vercel/blob');
      const blob = blobModule.default || blobModule;
      
      // Use allSettled for partial success
      const results = await Promise.allSettled(
        req.files.map(async (file) => {
          const uniqueName = generateFilename(file.originalname, file.buffer);
          const blobPath = `uploads/${uniqueName}`;
          
          const blobResult = await blob.put(blobPath, file.buffer, {
            access: 'public'
          });
          
          return {
            url: blobResult.url,
            filename: blobPath,
            originalName: file.originalname,
            size: file.size
          };
        })
      );
      
      const successful = results
        .filter(r => r.status === 'fulfilled')
        .map(r => r.value);
      const failed = results.filter(r => r.status === 'rejected');
      
      console.log(`[${requestId}] Results: ${successful.length} succeeded, ${failed.length} failed`);
      
      if (successful.length === 0) {
        return res.status(500).json({ 
          error: 'All uploads failed',
          requestId
        });
      }
      
      images = successful;
      
      if (failed.length > 0 && successful.length > 0) {
        // Partial success - still return 200 with warning
        return res.status(200).json({ 
          success: true,
          partial: true,
          uploaded: successful.length,
          total: req.files.length,
          images: successful,
          warning: `${failed.length} file(s) failed to upload`
        });
      }
    } else {
      // Local dev
      images = req.files.map(file => ({
        url: `/uploads/${file.filename}`,
        filename: file.filename,
        originalName: file.originalname,
        size: file.size
      }));
    }
    
    res.json({ success: true, images });
    
  } catch (err) {
    console.error(`[${requestId}] Multiple upload error:`, err);
    
    let userMessage = 'Failed to upload images';
    if (err.message.includes('Storage service')) {
      userMessage = 'Storage service unavailable.';
    }
    
    res.status(500).json({ 
      error: userMessage,
      requestId
    });
  }
});

// Error handling
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size too large. Maximum 5MB allowed.' });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: 'Too many files. Maximum 10 allowed.' });
    }
    return res.status(400).json({ error: err.message });
  }
  
  if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
});

module.exports = router;
