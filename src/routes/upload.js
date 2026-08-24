const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { authenticate } = require('../middleware/auth');
const { supabaseAdmin } = require('../config/supabase');

// Configure multer for image uploads (use memory storage)
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

// Upload single image to Supabase Storage
router.post('/image', authenticate, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded' });
    }

    const fileExt = path.extname(req.file.originalname);
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}${fileExt}`;
    const filePath = `${req.user.id}/${fileName}`;

    const { data, error } = await supabaseAdmin.storage
      .from('business-images')
      .upload(filePath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: true
      });

    if (error) {
      console.error('Supabase upload error:', error);
      return res.status(500).json({ error: 'Failed to upload image' });
    }

    // Get public URL
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('business-images')
      .getPublicUrl(filePath);

    res.json({
      success: true,
      url: publicUrl,
      path: filePath,
      filename: req.file.originalname,
      size: req.file.size,
      provider: 'supabase'
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message || 'Failed to upload image' });
  }
});

// Upload multiple images to Supabase Storage
router.post('/images', authenticate, upload.array('images', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No images uploaded' });
    }

    const uploadPromises = req.files.map(async (file) => {
      const fileExt = path.extname(file.originalname);
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}${fileExt}`;
      const filePath = `${req.user.id}/${fileName}`;

      const { data, error } = await supabaseAdmin.storage
        .from('business-images')
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
          upsert: true
        });

      if (error) {
        console.error('Supabase upload error:', error);
        throw error;
      }

      const { data: { publicUrl } } = supabaseAdmin.storage
        .from('business-images')
        .getPublicUrl(filePath);

      return {
        url: publicUrl,
        path: filePath,
        filename: file.originalname,
        size: file.size,
        provider: 'supabase'
      };
    });

    const results = await Promise.all(uploadPromises);

    res.json({
      success: true,
      images: results
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message || 'Failed to upload images' });
  }
});

// Delete image from Supabase Storage
router.delete('/image/:path', authenticate, async (req, res) => {
  try {
    const { path: filePath } = req.params;

    if (!filePath) {
      return res.status(400).json({ error: 'File path is required' });
    }

    const { error } = await supabaseAdmin.storage
      .from('business-images')
      .remove([filePath]);

    if (error) {
      console.error('Supabase delete error:', error);
      return res.status(500).json({ error: 'Failed to delete image' });
    }

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
