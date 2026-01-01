
import mongoose from 'mongoose';

const ReelSchema = new mongoose.Schema({
  videoUrl: { type: String, required: true },
  caption: { type: String, required: true },
  scheduledTime: { type: Date, required: true },
  status: { type: String, enum: ['Pending', 'Processing', 'Published', 'Failed'], default: 'Pending' },
  instagramMediaId: { type: String },
  error: { type: String },
  createdAt: { type: Date, default: Date.now }
});

const Reel = mongoose.model('Reel', ReelSchema);
export default Reel;
