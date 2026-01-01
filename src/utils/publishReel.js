

import axios from 'axios';
import Reel from '../models/Reel.js';

// Helper to sleep for polling
const sleep = ms => new Promise(res => setTimeout(res, ms));

export default async function publishReel(reel) {
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  const userId = process.env.INSTAGRAM_USER_ID;
  if (!accessToken || !userId) throw new Error('Instagram credentials missing');

  // 1. Create media container
  let createRes;
  try {
    createRes = await axios.post(
      `https://graph.facebook.com/v19.0/${userId}/media`,
      {
        media_type: 'REELS',
        video_url: reel.videoUrl,
        caption: reel.caption,
        access_token: accessToken,
      }
    );
  } catch (err) {
    console.error('Instagram media container error:', err.response?.data || err.message);
    throw new Error('Instagram media container error: ' + (err.response?.data?.error?.message || err.message));
  }
  const containerId = createRes.data.id;

  // 2. Poll status
  let status = 'IN_PROGRESS';
  let attempts = 0;
  while (status === 'IN_PROGRESS' && attempts < 20) {
    await sleep(3000);
    const statusRes = await axios.get(
      `https://graph.facebook.com/v19.0/${containerId}?fields=status_code&access_token=${accessToken}`
    );
    status = statusRes.data.status_code;
    attempts++;
  }
  if (status !== 'FINISHED') throw new Error('Instagram processing failed');

  // 3. Publish
  const publishRes = await axios.post(
    `https://graph.facebook.com/v19.0/${userId}/media_publish`,
    {
      creation_id: containerId,
      access_token: accessToken,
    }
  );
  await Reel.findByIdAndUpdate(reel._id, {
    status: 'Published',
    instagramMediaId: publishRes.data.id,
  });
}
