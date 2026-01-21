

import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import reelsRouter from './routes/reels.js';
import scheduler from './scheduler.js';
import instagramAuthRouter from './routes/instagramAuth.js';

// Debug: Log Cloudinary env variables at startup
console.log('CLOUDINARY_CLOUD_NAME:', process.env.CLOUDINARY_CLOUD_NAME);
console.log('CLOUDINARY_API_KEY:', process.env.CLOUDINARY_API_KEY);
console.log('CLOUDINARY_API_SECRET:', process.env.CLOUDINARY_API_SECRET ? '***set***' : '***missing***');

const app = express();
app.use(cors());
app.use(express.json());



// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('MongoDB connected');
    // Start scheduler after DB is ready
    scheduler();
  })
  .catch(err => console.error('MongoDB connection error:', err));



// Routes
app.use('/api/reels', reelsRouter);
app.use('/auth/instagram', instagramAuthRouter);

// Health check
app.get('/', (req, res) => {
  res.send('Instagram Reels Scheduler Backend');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
