
import cron from 'node-cron';
import Reel from './models/Reel.js';
import publishReel from './utils/publishReel.js';

export default function startScheduler() {
  // Runs every 15 minutes
  cron.schedule('*/15 * * * *', async () => {
    const now = new Date();
    // Find the earliest pending reel
    const reel = await Reel.findOne({ status: 'Pending', scheduledTime: { $lte: now } }).sort({ scheduledTime: 1 });
    if (reel) {
      try {
        await Reel.findByIdAndUpdate(reel._id, { status: 'Processing' });
        await publishReel(reel);
      } catch (err) {
        await Reel.findByIdAndUpdate(reel._id, { status: 'Failed', error: err.message });
      }
    }
  });
}
