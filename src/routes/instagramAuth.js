import express from 'express';
import axios from 'axios';
import crypto from 'crypto';
import InstagramAuth from '../models/InstagramAuth.js';

const router = express.Router();

// In-memory state store to validate OAuth responses without sessions.
const stateStore = new Map(); // state -> timestamp
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

const scopes = [
  'pages_show_list',
  'pages_read_engagement',
  'instagram_basic',
  'instagram_content_publish',
].join(',');

function buildRedirectUri(req) {
  // Allow explicit override when hosted behind a proxy/CDN.
  if (process.env.META_REDIRECT_URI) return process.env.META_REDIRECT_URI;
  const proto = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.get('host');
  return `${proto}://${host}/auth/instagram/callback`;
}

function frontendReturnUrl() {
  return process.env.CLIENT_APP_URL || process.env.FRONTEND_URL || 'http://localhost:3000/';
}

function validateEnv(res) {
  if (!process.env.META_APP_ID || !process.env.META_APP_SECRET) {
    res.status(500).json({ error: 'Meta App ID/Secret missing in environment' });
    return false;
  }
  return true;
}

function rememberState(state) {
  stateStore.set(state, Date.now());
}

function verifyAndConsumeState(state) {
  if (!state) return false;
  const created = stateStore.get(state);
  if (!created) return false;
  if (Date.now() - created > STATE_TTL_MS) {
    stateStore.delete(state);
    return false;
  }
  stateStore.delete(state);
  return true;
}

function cleanupExpiredStates() {
  const now = Date.now();
  for (const [key, value] of stateStore.entries()) {
    if (now - value > STATE_TTL_MS) stateStore.delete(key);
  }
}

// Generate Meta OAuth URL and redirect user.
router.get('/start', (req, res) => {
  cleanupExpiredStates();
  if (!validateEnv(res)) return;
  const state = crypto.randomBytes(16).toString('hex');
  rememberState(state);
  const redirectUri = buildRedirectUri(req);
  const authUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${encodeURIComponent(process.env.META_APP_ID)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}&scope=${encodeURIComponent(scopes)}`;
  res.redirect(authUrl);
});

// OAuth callback handler
router.get('/callback', async (req, res) => {
  if (!validateEnv(res)) return;
  const frontendUrl = frontendReturnUrl();
  const failRedirect = (message) => {
    const url = new URL(frontendUrl);
    url.searchParams.set('instagram_status', 'error');
    url.searchParams.set('instagram_message', message || 'Instagram connection failed');
    return res.redirect(url.toString());
  };

  const { code, state, error, error_description: errorDescription } = req.query;

  if (error) {
    return failRedirect(errorDescription || error || 'User cancelled Instagram connection');
  }

  if (!verifyAndConsumeState(state)) {
    return failRedirect('Invalid or expired Instagram OAuth session. Please retry.');
  }

  if (!code) {
    return failRedirect('Missing OAuth code from Meta');
  }

  const redirectUri = buildRedirectUri(req);

  let shortLivedToken;
  try {
    const tokenRes = await axios.get('https://graph.facebook.com/v19.0/oauth/access_token', {
      params: {
        client_id: process.env.META_APP_ID,
        client_secret: process.env.META_APP_SECRET,
        redirect_uri: redirectUri,
        code,
      },
    });
    shortLivedToken = tokenRes.data?.access_token;
    if (!shortLivedToken) throw new Error('Meta did not return an access token');
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    return failRedirect(`Token exchange failed: ${msg}`);
  }

  let accessToken = shortLivedToken;
  try {
    const longRes = await axios.get('https://graph.facebook.com/v19.0/oauth/access_token', {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: process.env.META_APP_ID,
        client_secret: process.env.META_APP_SECRET,
        fb_exchange_token: shortLivedToken,
      },
    });
    accessToken = longRes.data?.access_token || accessToken;
  } catch (err) {
    // Continue with short-lived token; do not fail outright.
  }

  let pages;
  try {
    const pagesRes = await axios.get('https://graph.facebook.com/v19.0/me/accounts', {
      params: { access_token: accessToken },
    });
    pages = pagesRes.data?.data || [];
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    return failRedirect(`Unable to fetch managed Pages: ${msg}`);
  }

  let instagramUserId = null;
  let selectedPage = null;
  for (const page of pages) {
    try {
      const pageRes = await axios.get(`https://graph.facebook.com/v19.0/${page.id}`, {
        params: {
          fields: 'instagram_business_account',
          access_token: accessToken,
        },
      });
      const igId = pageRes.data?.instagram_business_account?.id;
      if (igId) {
        instagramUserId = igId;
        selectedPage = page;
        break;
      }
    } catch (err) {
      // Skip pages that error out; continue to next page.
    }
  }

  if (!instagramUserId) {
    return failRedirect('No Instagram Business/Creator account linked to your Pages');
  }

  try {
    const doc = new InstagramAuth({
      accessToken,
      instagramUserId,
      pageId: selectedPage?.id,
      pageName: selectedPage?.name,
    });
    await doc.save();
  } catch (err) {
    const msg = err.message || 'Unable to persist Instagram token';
    return failRedirect(msg);
  }

  const successUrl = new URL(frontendUrl);
  successUrl.searchParams.set('instagram_status', 'success');
  successUrl.searchParams.set('instagram_message', 'Instagram account connected');
  res.redirect(successUrl.toString());
});

export default router;

