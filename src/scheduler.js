
import cron from 'node-cron';
import Reel from './models/Reel.js';
import publishReel from './utils/publishReel.js';

export default function startScheduler() {
  // Runs every 15 minutes
  // Minimum gap in ms (15 minutes)
  const MIN_GAP_MS = 15 * 60 * 1000;
  let lastPublishedTime = 0;
  cron.schedule('*/15 * * * *', async () => {
    const now = new Date();
    // Only publish if enough time has passed since last publish
    if (now.getTime() - lastPublishedTime < MIN_GAP_MS) return;
    // Find the earliest pending reel
    const reel = await Reel.findOne({ status: 'Pending', scheduledTime: { $lte: now } }).sort({ scheduledTime: 1 });
    if (reel) {
      try {
        await Reel.findByIdAndUpdate(reel._id, { status: 'Processing' });
        await publishReel(reel);
        lastPublishedTime = Date.now();
      } catch (err) {
        await Reel.findByIdAndUpdate(reel._id, { status: 'Failed', error: err.message });
      }
    }
  });
}
