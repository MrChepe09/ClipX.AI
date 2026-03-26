require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Replicate = require('replicate');

// Validate critical env vars at startup
if (!process.env.REPLICATE_API_KEY) {
  throw new Error('REPLICATE_API_KEY is not set');
}
if (!process.env.API_SECRET) {
  throw new Error('API_SECRET is not set');
}

const app = express();
const CORS_ORIGINS = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const isAllowedOrigin = (origin) => {
  if (!origin) return true; // mobile apps / curl / server-to-server

  const expoDevPatterns = [
    /^exp:\/\//i,
    /^exps:\/\//i,
    /^http:\/\/localhost(?::\d+)?$/i,
    /^http:\/\/127\.0\.0\.1(?::\d+)?$/i,
    /^http:\/\/192\.168\.[0-9.]+(?::\d+)?$/i,
    /^https:\/\/.*\.expo\.dev$/i,
    /^https:\/\/u\.expo\.dev$/i,
  ];

  if (CORS_ORIGINS.includes(origin)) {
    return true;
  }

  if (CORS_ORIGINS.length === 0) {
    return true;
  }

  return expoDevPatterns.some((pattern) => pattern.test(origin));
};

app.use(
  cors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        return callback(null, true);
      }

      console.warn(`Blocked CORS origin: ${origin}`);
      return callback(new Error('Not allowed by CORS'));
    },
  })
);
app.use(express.json({ limit: '20mb' }));

// Strict security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

const PORT = process.env.PORT || 5000;
const DEMO_MODE = process.env.DEMO_MODE === 'true';
const REPLICATE_REQUEST_DELAY_MS = Number(process.env.REPLICATE_REQUEST_DELAY_MS || 1200);
const MODEL_TARGET = process.env.MODEL_TARGET || 'google/gemini-2.5-flash-image';

// Replicate client
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_KEY,
});

// Style prompts for each clipart type
const STYLE_PROMPTS = {
  cartoon: 'vibrant cartoon illustration with bold expressive outlines, cel shading style, bright saturated colors, exaggerated facial features, dynamic composition, professional quality animation art',
  flat: 'minimalist flat design illustration, vector art style, bold solid colors with subtle gradients, geometric shapes, modern clean aesthetic, limited but harmonious color palette, professional branding style',
  anime: 'detailed anime illustration in vibrant Japanese animation style, expressive eyes with sparkle, intricate hair details, smooth cel shading, dynamic pose, studio quality, professional manga-inspired composition',
  pixel: 'retro 16-bit pixel art style with crisp pixelated edges, limited color palette with high contrast, nostalgic video game aesthetic, clean sprite-like rendering, sharp blocky details, classic game art quality',
  sketch: 'artistic pencil sketch with detailed black and white line work, realistic shading with crosshatching, fine detail in facial features, expressive line quality, classical drawing technique, gallery-quality illustration',
};

const STYLE_SETTINGS = {
  cartoon: { prompt_strength: 0.62, guidance_scale: 7.2 },
  flat: { prompt_strength: 0.66, guidance_scale: 7.0 },
  anime: { prompt_strength: 0.70, guidance_scale: 7.6 },
  pixel: { prompt_strength: 0.74, guidance_scale: 8.0 },
  sketch: { prompt_strength: 0.58, guidance_scale: 6.6 },
};

// Valid styles
const VALID_STYLES = Object.keys(STYLE_PROMPTS);

// --- Rate Limiting (simple in-memory) ---
const requestCounts = {};
const RATE_LIMIT = 5;
const RATE_WINDOW = 60 * 1000; // 1 minute

const rateLimit = (req, res, next) => {
  const ip = req.ip;
  const now = Date.now();

  if (!requestCounts[ip]) requestCounts[ip] = [];

  // Remove old timestamps outside window
  requestCounts[ip] = requestCounts[ip].filter(t => now - t < RATE_WINDOW);

  if (requestCounts[ip].length >= RATE_LIMIT) {
    return res.status(429).json({ error: 'Too many requests. Wait 1 minute.' });
  }

  requestCounts[ip].push(now);
  next();
};

// --- API Secret Validation ---
const validateSecret = (req, res, next) => {
  const secret = req.headers['x-api-secret'];
  if (secret !== process.env.API_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// --- Health Check ---
app.get('/health', (req, res) => {
  res.json({ status: 'ok', modelTarget: MODEL_TARGET, demoMode: DEMO_MODE });
});

// --- Generate Clipart Endpoint ---
app.post('/api/generate-clipart', validateSecret, rateLimit, async (req, res) => {
  try {
    const { imageBase64, styles } = req.body;

    // Input validation
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return res.status(400).json({ error: 'imageBase64 is required' });
    }
    if (!styles || !Array.isArray(styles) || styles.length === 0) {
      return res.status(400).json({ error: 'styles array is required' });
    }
    const invalidStyles = styles.filter(s => !VALID_STYLES.includes(s));
    if (invalidStyles.length > 0) {
      return res.status(400).json({ error: `Invalid styles: ${invalidStyles.join(', ')}` });
    }
    // Rough size check (~5MB base64 limit)
    if (imageBase64.length > 7_000_000) {
      return res.status(400).json({ error: 'Image too large. Max 5MB.' });
    }

    if (!process.env.REPLICATE_API_KEY) {
      return res.status(500).json({ error: 'Server misconfiguration: API key missing.' });
    }

    // Demo fallback mode for local development when Replicate credits are unavailable.
    if (DEMO_MODE) {
      const output = {};
      styles.forEach((style) => {
        const demoSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="#B91C1C"/>
  <rect x="32" y="32" width="960" height="960" fill="none" stroke="#FCA5A5" stroke-width="8"/>
  <text x="50%" y="45%" text-anchor="middle" fill="#FEE2E2" font-size="64" font-family="Arial" font-weight="700">DEMO MODE</text>
  <text x="50%" y="54%" text-anchor="middle" fill="#FECACA" font-size="38" font-family="Arial">${String(style).toUpperCase()}</text>
  <text x="50%" y="62%" text-anchor="middle" fill="#FECACA" font-size="28" font-family="Arial">OLD IMAGE (SIMULATED)</text>
</svg>`;
        const demoDataUri = `data:image/svg+xml;utf8,${encodeURIComponent(demoSvg)}`;

        output[style] = {
          status: 'success',
          url: demoDataUri,
          style,
          note: 'DEMO_MODE enabled - returning red simulated old image',
        };
      });

      return res.json({ success: true, results: output, demoMode: true });
    }

    // Generate styles sequentially to reduce 429 throttle risk on free-tier limits.
    const results = [];
    for (const style of styles) {
      const result = await generateStyle(imageBase64, style);
      results.push(result);

      if (result.status === 'failed' && result.code === 402) {
        // Stop early when billing/credit is missing.
        break;
      }

      await wait(REPLICATE_REQUEST_DELAY_MS);
    }

    // Build response object { cartoon: {...}, anime: {...}, ... }
    const output = {};
    styles.forEach((style, i) => {
      output[style] =
        results[i] || {
          status: 'failed',
          style,
          code: 402,
          error: 'Skipped because account has insufficient Replicate credit',
        };
    });

    res.json({ success: true, results: output });
  } catch (error) {
    console.error('Generate error:', error.message);
    res.status(500).json({ error: 'Generation failed. Please try again.' });
  }
});

// --- Single Style Generation ---
async function generateStyle(imageBase64, style) {
  try {
    const styleSettings = STYLE_SETTINGS[style] || {
      prompt_strength: 0.62,
      guidance_scale: 7.5,
    };

    const sanitizedBase64 = String(imageBase64).replace(/^data:image\/[a-zA-Z]+;base64,/, '');
    let output;

    if (MODEL_TARGET === 'google/gemini-2.5-flash-image' || MODEL_TARGET === 'gemini-2.5-flash-image') {
      output = await replicate.run('google/gemini-2.5-flash-image', {
        input: {
          prompt: `Transform this person photo into ${style} clipart style while preserving face identity and pose. ${STYLE_PROMPTS[style]}`,
          image_input: [`data:image/jpeg;base64,${sanitizedBase64}`],
          aspect_ratio: 'match_input_image',
          output_format: 'jpg',
        },
      });
    } else if (MODEL_TARGET === 'qwen-image-2512') {
      // Optional path if you explicitly want to test Qwen.
      // Note: qwen model behavior/inputs can change; SDXL path below is the stable img2img default.
      output = await replicate.run('qwen/qwen-image-2512', {
        input: {
          image: `data:image/jpeg;base64,${sanitizedBase64}`,
          prompt: `Transform into ${style} style while preserving the person's facial features and pose. ${STYLE_PROMPTS[style]}`,
          negative_prompt: 'completely different person, extra people, deformed, broken, blurry, low quality, different face',
        },
      });
    } else {
      output = await replicate.run(
        'stability-ai/sdxl:7762fd07cf82c948538e41f63f77d685e02b063e37e496e96eefd46c929f9bdc',
        {
          input: {
            image: `data:image/jpeg;base64,${sanitizedBase64}`,
            prompt: `Transform into ${style} style while preserving the person's facial features and pose. ${STYLE_PROMPTS[style]}`,
            negative_prompt: 'completely different person, extra people, deformed, broken, blurry, low quality, different face',
            prompt_strength: styleSettings.prompt_strength,
            num_inference_steps: 45,
            guidance_scale: styleSettings.guidance_scale,
          },
        }
      );
    }

    // Replicate can return string URLs or FileOutput objects depending on SDK/runtime.
    const raw = Array.isArray(output) ? output[0] : output;
    const url = normalizeReplicateUrl(raw);

    if (!url) {
      return {
        status: 'failed',
        error: 'Replicate output did not contain a usable URL',
        style,
      };
    }

    return { status: 'success', url, style };
  } catch (error) {
    const code = error?.status || error?.response?.status;
    const message = error?.message || 'Unknown generation error';
    console.error(`Error generating ${style}:`, message);

    if (/nsfw|safety/i.test(message)) {
      return {
        status: 'failed',
        code: 422,
        error: 'Image was blocked by model safety filters. Try a different photo or retry with another style.',
        style,
      };
    }

    if (code === 402) {
      return {
        status: 'failed',
        code,
        error: 'Replicate billing/credit is required. Add credit or enable DEMO_MODE=true in backend/.env',
        style,
      };
    }

    if (code === 429) {
      return {
        status: 'failed',
        code,
        error: 'Replicate rate limit hit. Retry after a few seconds, or set DEMO_MODE=true for development.',
        style,
      };
    }

    return { status: 'failed', code, error: message, style };
  }
}

function normalizeReplicateUrl(value) {
  if (!value) return null;

  if (typeof value === 'string') {
    return value;
  }

  // Replicate FileOutput often has a .url() function or .href property.
  if (typeof value?.url === 'function') {
    return value.url();
  }

  if (typeof value?.url === 'string') {
    return value.url;
  }

  if (typeof value?.href === 'string') {
    return value.href;
  }

  if (typeof value?.toString === 'function') {
    const str = value.toString();
    if (typeof str === 'string' && /^https?:\/\//i.test(str)) {
      return str;
    }
  }

  return null;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Global error handler
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';
  console.error(`[${new Date().toISOString()}] Error:`, message);
  res.status(statusCode).json({ error: message, code: statusCode });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});