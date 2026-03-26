# ClipX.AI – AI Clipart Generator

ClipX.AI is an Expo React Native app that converts a user photo into multiple AI-generated clipart styles (cartoon, flat, anime, pixel, sketch) using a secure Express backend proxy with Replicate.

## Features

- Photo input from gallery or camera
- Image normalization and validation before upload
- Multi-style generation (sequential processing to reduce API throttling)
- Per-style status cards (`loading`, `success`, `failed`)
- Before/after image compare slider
- Retry failed styles individually
- Download and share generated images
- Secure backend API secret validation
- Basic rate limiting and CORS controls

## Tech Stack

### Frontend
- Expo + React Native + TypeScript
- Expo Router for navigation
- `expo-image-picker`, `expo-image-manipulator`
- `expo-file-system`, `expo-sharing`

### Backend
- Node.js + Express
- Replicate SDK for model inference
- `dotenv` for environment config
- In-memory request rate limiting

## Project Structure

- `app/` → Screens and router layouts
- `src/services/` → API and image utility services
- `backend/` → Express API server

Key files:
- `app/(tabs)/index.tsx` – upload + style selection screen
- `app/generation.tsx` – generation results and compare UI
- `src/services/imageService.ts` – image pick/normalize/validate
- `src/services/clipartService.ts` – client API calls
- `backend/server.js` – API, validation, generation logic

## Environment Variables

Copy templates and fill values:

- Frontend template: `.env.example`
- Backend template: `backend/.env.example`

Frontend `.env`:

```env
EXPO_PUBLIC_API_URL=https://your-backend-domain.com
EXPO_PUBLIC_API_SECRET=your_api_secret
```

Backend `backend/.env`:

```env
PORT=3001
REPLICATE_API_KEY=your_replicate_key
API_SECRET=your_api_secret
DEMO_MODE=false
MODEL_TARGET=sdxl-img2img
REPLICATE_REQUEST_DELAY_MS=1200
CORS_ORIGINS=https://your-frontend-domain.com
```

## Local Development

### 1) Install dependencies

```bash
# frontend
npm install

# backend
cd backend
npm install
```

### 2) Start backend

```bash
cd backend
npm start
```

### 3) Start Expo app

```bash
npx expo start
```

## Android (Expo Go on physical device)

- Ensure phone and laptop are on the same Wi-Fi network
- Set `EXPO_PUBLIC_API_URL` to a reachable backend URL (not `localhost`)
- Reload Expo app after env changes

## API Endpoints

### `GET /health`
Returns service status, active model target, and demo mode state.

### `POST /api/generate-clipart`
Headers:
- `Content-Type: application/json`
- `x-api-secret: <API_SECRET>`

Body:

```json
{
  "imageBase64": "<base64 image>",
  "styles": ["cartoon", "anime"]
}
```

## Deployment (Recommended)

- Deploy `backend/` as a Node service on Railway/Fly/VPS
- Set backend environment variables in host dashboard
- Use deployed HTTPS URL in frontend `.env`

## Security Notes

- Do not commit real `.env` files
- Rotate `REPLICATE_API_KEY` and `API_SECRET` if exposed
- Keep strict `CORS_ORIGINS` in production

## Current Status

- Core app and backend flow implemented
- Ready for deployment, E2E validation, and release packaging

## Submission placeholders

- APK / AAB link: _Add here_
- Demo video link: _Add here_
