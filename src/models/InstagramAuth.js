import mongoose from 'mongoose';

// Stores Instagram OAuth tokens without affecting existing Reel logic.
// We keep entries append-only to avoid overwriting any tokens already in use.
const InstagramAuthSchema = new mongoose.Schema({
  accessToken: { type: String, required: true },
  instagramUserId: { type: String, required: true },
  pageId: { type: String },
  pageName: { type: String },
  source: { type: String, default: 'meta_oauth' },
  createdAt: { type: Date, default: Date.now },
});

const InstagramAuth = mongoose.model('InstagramAuth', InstagramAuthSchema);
export default InstagramAuth;

