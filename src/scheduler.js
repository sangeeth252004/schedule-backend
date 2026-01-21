import cron from 'node-cron';
import Reel from './models/Reel.js';
import publishReel from './utils/publishReel.js';

function getRandomTimeToday() {
  const startHour = 10; // 10 AM
  const endHour = 22;   // 10 PM

  const hour = Math.floor(Math.random() * (endHour - startHour)) + startHour;
  const minute = Math.floor(Math.random() * 60);

  const date = new Date();
  date.setHours(hour, minute, 0, 0);

  return date;
}

export default function startScheduler() {

  // 🕛 STEP 1: ONCE PER DAY → assign random times to 2 reels
  cron.schedule('5 0 * * *', async () => {
    console.log('📅 Daily reel scheduler started');

    const reels = await Reel.find({
      status: 'Pending',
      scheduledTime: { $exists: false }
    }).limit(2);

    for (const reel of reels) {
      const randomTime = getRandomTimeToday();
      await Reel.findByIdAndUpdate(reel._id, {
        scheduledTime: randomTime
      });

      console.log(`🕒 Reel ${reel._id} scheduled at ${randomTime}`);
    }
  });

  // ⏱ STEP 2: CHECK EVERY MINUTE → publish if time reached
  cron.schedule('* * * * *', async () => {
    const now = new Date();

    const reel = await Reel.findOneAndUpdate(
      {
        status: 'Pending',
        scheduledTime: { $lte: now }
      },
      { status: 'Processing' },
      { sort: { scheduledTime: 1 }, new: true }
    );

    if (!reel) return;

    try {
      await publishReel(reel);

      await Reel.findByIdAndUpdate(reel._id, {
        status: 'Published',
        publishedAt: new Date()
      });

      console.log('✅ Reel published:', reel._id);
    } catch (err) {
      await Reel.findByIdAndUpdate(reel._id, {
        status: 'Failed',
        error: err.message
      });
    }
  });
}
