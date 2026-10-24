const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { supabase, isConfigured: isSupabaseConfigured } = require('../config/supabase');

const BUCKET_NAME = process.env.SUPABASE_STORAGE_BUCKET || 'property-images';
const LOCAL_UPLOAD_DIR = path.join(__dirname, '..', 'frontend', 'uploads', 'properties');

// Ensure local upload folder exists
try {
  if (!fs.existsSync(LOCAL_UPLOAD_DIR)) {
    fs.mkdirSync(LOCAL_UPLOAD_DIR, { recursive: true });
  }
} catch (err) {
  console.warn('[Storage] Warning creating local upload directory:', err.message);
}

let bucketChecked = false;

/**
 * Checks if the Supabase storage bucket exists; creates it if allowed.
 */
async function ensureSupabaseBucket() {
  if (!isSupabaseConfigured || !supabase) return false;
  if (bucketChecked) return true;

  try {
    const { data: buckets, error: listErr } = await supabase.storage.listBuckets();
    if (listErr) {
      console.warn('[Supabase Storage] Notice checking buckets:', listErr.message);
      bucketChecked = true;
      return false;
    }

    const exists = buckets && buckets.some((b) => b.name === BUCKET_NAME);
    if (!exists) {
      const { error: createErr } = await supabase.storage.createBucket(BUCKET_NAME, {
        public: true,
        fileSizeLimit: 10 * 1024 * 1024 // 10MB
      });
      if (createErr) {
        console.warn(`[Supabase Storage] Could not auto-create bucket '${BUCKET_NAME}':`, createErr.message);
      } else {
        console.log(`[Supabase Storage] Public bucket '${BUCKET_NAME}' created.`);
      }
    }
    bucketChecked = true;
    return true;
  } catch (err) {
    console.warn('[Supabase Storage] Bucket check skipped:', err.message);
    bucketChecked = true;
    return false;
  }
}

/**
 * Upload a single file buffer to Supabase Storage.
 * Returns public URL on success, null on failure.
 */
async function uploadToSupabase(file, sanitizedName) {
  if (!isSupabaseConfigured || !supabase) return null;

  try {
    await ensureSupabaseBucket();

    const timestamp = Date.now();
    const randomHex = crypto.randomBytes(4).toString('hex');
    const objectKey = `listings/${timestamp}_${randomHex}_${sanitizedName}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(objectKey, file.buffer, {
        contentType: file.mimetype || 'image/jpeg',
        upsert: true,
        cacheControl: '3600'
      });

    if (uploadError) {
      console.warn('[Supabase Storage] Upload error:', uploadError.message);
      return null;
    }

    const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(objectKey);
    return data?.publicUrl || null;
  } catch (err) {
    console.warn('[Supabase Storage] Upload exception:', err.message);
    return null;
  }
}

/**
 * Upload a single file buffer to local disk fallback.
 * Returns relative URL path on success.
 */
async function uploadToLocalDisk(file, sanitizedName) {
  if (!fs.existsSync(LOCAL_UPLOAD_DIR)) {
    fs.mkdirSync(LOCAL_UPLOAD_DIR, { recursive: true });
  }

  const timestamp = Date.now();
  const randomHex = crypto.randomBytes(4).toString('hex');
  const fileName = `${timestamp}_${randomHex}_${sanitizedName}`;
  const filePath = path.join(LOCAL_UPLOAD_DIR, fileName);

  await fs.promises.writeFile(filePath, file.buffer);
  return `/uploads/properties/${fileName}`;
}

/**
 * Upload an image file with automatic Supabase Cloud -> Local Disk fallback.
 */
async function uploadPropertyImage(file) {
  const originalName = file.originalname || 'property-image.jpg';
  const ext = (path.extname(originalName) || '.jpg').toLowerCase();
  const base = path.basename(originalName, ext)
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 32);
  const sanitizedName = `${base}${ext}`;

  // 1. Try Supabase Storage first if configured
  if (isSupabaseConfigured) {
    const supabaseUrl = await uploadToSupabase(file, sanitizedName);
    if (supabaseUrl) {
      return {
        url: supabaseUrl,
        storage: 'supabase',
        originalName,
        size: file.size,
        mimetype: file.mimetype
      };
    }
  }

  // 2. Seamless local disk fallback
  const localUrl = await uploadToLocalDisk(file, sanitizedName);
  return {
    url: localUrl,
    storage: 'local',
    originalName,
    size: file.size,
    mimetype: file.mimetype
  };
}

/**
 * Upload multiple property images.
 */
async function uploadPropertyImages(files) {
  if (!Array.isArray(files) || files.length === 0) return [];
  const results = [];
  for (const file of files) {
    const res = await uploadPropertyImage(file);
    results.push(res);
  }
  return results;
}

module.exports = {
  uploadPropertyImage,
  uploadPropertyImages,
  isSupabaseConfigured: () => Boolean(isSupabaseConfigured && supabase),
  BUCKET_NAME
};
