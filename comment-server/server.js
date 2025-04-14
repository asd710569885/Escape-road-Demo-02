const express = require('express');
// const fs = require('fs').promises; // Removed fs
const path = require('path');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const { createClient } = require('@vercel/kv'); // Import Vercel KV client

const app = express();
const port = 3000;

// --- Vercel KV Client Setup ---
// Reads connection details from Vercel environment variables
const kv = createClient({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

// --- Rate Limiting Setup ---
const submissionTimestamps = {}; // In-memory store: { ip: { action_gameId: timestamp } }
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute in milliseconds

// Middleware
app.use(cors()); // Enable Cross-Origin Resource Sharing
app.use(express.json()); // Parse JSON request bodies

// --- Rate Limiting Check Function (Updated) ---
const checkRateLimit = (ip, gameId, actionType) => {
    const now = Date.now();
    const key = `${actionType}_${gameId}`;

    if (!submissionTimestamps[ip]) {
        // First submission from this IP
        return true;
    }

    const lastSubmissionTime = submissionTimestamps[ip][key];

    if (lastSubmissionTime && (now - lastSubmissionTime < RATE_LIMIT_WINDOW_MS)) {
        // Still within the rate limit window for this specific action and game
        return false; // Indicate rate limited
    }
    return true; // Indicate OK to proceed
};

// --- API Endpoints for Comments ---

// GET /api/comments/:gameId - Get comments using KV
app.get('/api/comments/:gameId', async (req, res) => {
  const { gameId } = req.params;
  if (!gameId) {
    return res.status(400).json({ message: 'gameId parameter is required' });
  }

  try {
    // Comments stored as a list in KV under the key `comments:${gameId}`
    // LRANGE 0 -1 gets all elements
    const comments = await kv.lrange(`comments:${gameId}`, 0, -1);
    res.json(comments || []); // Return empty array if key doesn't exist or is empty
  } catch (error) {
    console.error(`Error fetching comments for ${gameId} from KV:`, error);
    res.status(500).json({ message: 'Error fetching comments.' });
  }
});

// POST /api/comments/:gameId - Add a new comment using KV
app.post('/api/comments/:gameId', async (req, res) => {
  const clientIp = req.ip;
  const { gameId } = req.params;
  const { name, email, content } = req.body;
  const actionType = 'comment'; // Define action type

  // 1. Check Rate Limit for this specific action and game
  if (!checkRateLimit(clientIp, gameId, actionType)) {
      return res.status(429).json({ message: `对该游戏的评论过于频繁，请稍后再试 (一分钟限制)。` });
  }

  // Basic validation
  if (!gameId) {
    return res.status(400).json({ message: 'gameId parameter is required' });
  }
  if (!name || !email || !content) {
    return res.status(400).json({ message: 'Missing required fields: name, email, content' });
  }
   if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
     return res.status(400).json({ message: 'Invalid email format.' });
   }

  const newComment = {
    id: uuidv4(),
    name: name.trim(),
    email: email.trim(),
    content: content.trim(),
    timestamp: new Date().toISOString(),
  };

  try {
    // Add the new comment to the beginning of the list for the gameId
    // LPUSH returns the new length of the list
    await kv.lpush(`comments:${gameId}`, newComment);

    // 2. Update timestamp only on successful write for this specific action and game
    if (!submissionTimestamps[clientIp]) {
        submissionTimestamps[clientIp] = {};
    }
    submissionTimestamps[clientIp][`${actionType}_${gameId}`] = Date.now();

    res.status(201).json(newComment);
  } catch (error) {
    console.error(`Error saving comment for ${gameId} to KV:`, error);
    res.status(500).json({ message: 'Error saving comment.' });
  }
});

// --- API Endpoints for Ratings ---

// GET /api/ratings/:gameId - Get rating using KV
app.get('/api/ratings/:gameId', async (req, res) => {
  const { gameId } = req.params;
  if (!gameId) {
    return res.status(400).json({ message: 'gameId parameter is required' });
  }

  try {
    // Ratings stored as a Hash in KV under the key `rating:${gameId}`
    // HGETALL returns an object like { totalScore: '45', count: '10' } or null
    const gameRatingData = await kv.hgetall(`rating:${gameId}`);

    const totalScore = gameRatingData ? parseInt(gameRatingData.totalScore || '0', 10) : 0;
    const count = gameRatingData ? parseInt(gameRatingData.count || '0', 10) : 0;

    const average = count > 0 ? (totalScore / count) : 0;
    res.json({
      average: average.toFixed(1),
      count: count,
    });
  } catch (error) {
    console.error(`Error fetching rating for ${gameId} from KV:`, error);
    res.status(500).json({ message: 'Error fetching rating.' });
  }
});

// POST /api/ratings/:gameId - Submit a rating using KV
app.post('/api/ratings/:gameId', async (req, res) => {
  const clientIp = req.ip;
  const { gameId } = req.params;
  const { score } = req.body;
  const actionType = 'rating'; // Define action type

  // 1. Check Rate Limit for this specific action and game
  if (!checkRateLimit(clientIp, gameId, actionType)) {
      return res.status(429).json({ message: `对该游戏的评分过于频繁，请稍后再试 (一分钟限制)。` });
  }

  // Validation
  if (!gameId) {
    return res.status(400).json({ message: 'gameId parameter is required' });
  }
  const numericScore = parseInt(score, 10);
  if (isNaN(numericScore) || numericScore < 1 || numericScore > 5) {
    return res.status(400).json({ message: 'Invalid score. Score must be between 1 and 5.' });
  }

  try {
    const ratingKey = `rating:${gameId}`;

    // Increment totalScore and count atomically using HINCRBY
    // HINCRBY returns the new value after incrementing
    const newTotalScore = await kv.hincrby(ratingKey, 'totalScore', numericScore);
    const newCount = await kv.hincrby(ratingKey, 'count', 1);

    // 2. Update timestamp only on successful write for this specific action and game
    if (!submissionTimestamps[clientIp]) {
        submissionTimestamps[clientIp] = {};
    }
    submissionTimestamps[clientIp][`${actionType}_${gameId}`] = Date.now();

    const newAverage = (newTotalScore / newCount);
    res.status(201).json({
      average: newAverage.toFixed(1),
      count: newCount,
      message: 'Rating submitted successfully!'
    });

  } catch (error) {
    console.error(`Error saving rating for ${gameId} to KV:`, error);
    res.status(500).json({ message: 'Error saving rating.' });
  }
});

// --- Start Server ---
app.listen(port, () => {
  console.log(`Comment server listening at http://localhost:${port}`);
}); 