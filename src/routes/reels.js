



import express from 'express';
import Reel from '../models/Reel.js';
import upload from '../utils/upload.js';
import cloudinary from '../utils/cloudinary.js';


const router = express.Router();

// Upload reels (multiple)

router.post('/upload', upload.array('videos', 80), async (req, res) => {
  try {
    const files = req.files;
    const { captions, scheduledTimes } = req.body;
    if (!files || !captions || !scheduledTimes) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const captionsArr = Array.isArray(captions) ? captions : [captions];
    const timesArr = Array.isArray(scheduledTimes) ? scheduledTimes : [scheduledTimes];

    // Helper to upload a single file to Cloudinary using a Promise
    const uploadToCloudinary = (fileBuffer) => {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            resource_type: 'video',
            folder: 'instagram_reels',
            format: 'mp4',
          },
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          }
        );
        stream.end(fileBuffer);
      });
    };

    const results = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const caption = captionsArr[i] || '';
      const scheduledTime = timesArr[i] || new Date();
      // Upload to Cloudinary and save to DB
      const result = await uploadToCloudinary(file.buffer);
      const reel = new Reel({
        videoUrl: result.secure_url,
        caption,
        scheduledTime,
      });
      await reel.save();
      results.push(reel);
    }
    res.json({ reels: results });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// List all reels
router.get('/', async (req, res) => {
  try {
    const reels = await Reel.find().sort({ createdAt: -1 });
    res.json({ reels });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Delete a scheduled (pending) reel by ID
router.delete('/:id', async (req, res) => {
  try {
    const reel = await Reel.findById(req.params.id);
    if (!reel) return res.status(404).json({ error: 'Reel not found' });
    if (reel.status !== 'Pending') {
      return res.status(400).json({ error: 'Only pending (scheduled) reels can be deleted' });
    }
    await Reel.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
