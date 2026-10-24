const express = require('express');
const multer = require('multer');
const { requireOwnerOrAdmin } = require('../middleware/auth');
const { uploadPropertyImages, isSupabaseConfigured, BUCKET_NAME } = require('../utils/storage');

const router = express.Router();

// Allowed image MIME types
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/jpg'
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 12
  },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype.toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}. Allowed: JPG, PNG, WEBP, GIF, AVIF.`));
    }
  }
});

// Middleware to handle both 'images' and 'image' form fields
const uploadMiddleware = upload.fields([
  { name: 'images', maxCount: 12 },
  { name: 'image', maxCount: 12 },
  { name: 'files', maxCount: 12 }
]);

// GET /api/upload/config - check upload settings and storage status
router.get('/config', (req, res) => {
  res.json({
    supabaseStorageActive: isSupabaseConfigured(),
    bucket: BUCKET_NAME,
    maxFileSizeMb: 10,
    maxFiles: 12,
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
  });
});

// POST /api/upload/property-images - upload property photos (Owners & Admins)
router.post(
  '/property-images',
  requireOwnerOrAdmin,
  (req, res, next) => {
    uploadMiddleware(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'One of the files exceeds the 10MB limit.' });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({ error: 'You can upload up to 12 images at once.' });
        }
        return res.status(400).json({ error: `Upload error: ${err.message}` });
      } else if (err) {
        return res.status(400).json({ error: err.message });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      const files = [
        ...(req.files?.images || []),
        ...(req.files?.image || []),
        ...(req.files?.files || [])
      ];

      if (!files.length) {
        return res.status(400).json({ error: 'No image files provided. Please select at least one image.' });
      }

      const results = await uploadPropertyImages(files);
      const urls = results.map((r) => r.url);

      res.status(200).json({
        success: true,
        message: `${results.length} image${results.length === 1 ? '' : 's'} uploaded successfully.`,
        urls,
        files: results
      });
    } catch (err) {
      console.error('[Upload Error]', err);
      res.status(500).json({ error: 'Failed to process image upload. Please try again.' });
    }
  }
);

module.exports = router;
