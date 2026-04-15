# Leaderboard & Vercel Migration — Design Spec

## Overview

Migrate the Patta x Nike Soccer Tournament game from Cloudflare to Vercel hosting, and add a leaderboard system with score submission, email-based newsletter signup via Klaviyo, and bot protection.

**Context**: Brand activation campaign. Expected traffic: 50k–100k users. Short-lived deployment. Cost must stay near zero regardless of traffic volume.

## Architecture

### Hosting: Vercel

Static files (index.html, app.js, style.css, assets/) served directly by Vercel. Three serverless functions handle the backend logic. No framework migration — the existing vanilla JS stays as-is.

### Project Structure

```
/patta-game-concept/
├── api/
│   ├── start-session.js   — POST: create game session, return sessionId
│   ├── submit-score.js    — POST: validate session + score, store, call Klaviyo, return leaderboard
│   └── leaderboard.js     — GET: return cached top 10
├── index.html             — (unchanged)
├── app.js                 — add submission form logic + leaderboard rendering
├── style.css              — add styles for submission form + leaderboard
├── assets/                — (unchanged)
└── vercel.json            — routing config, caching headers
```

### Database: Upstash Redis (@upstash/redis)

Redis sorted sets are purpose-built for leaderboards. Three key patterns:

- **`leaderboard`** — Sorted set. Members are email addresses (the unique identifier), scores are the values. Provides top 10 (`ZREVRANGE`), rank lookups (`ZREVRANK`), and conditional insert (`ZADD GT`) as single commands. Display names are resolved from the player hash.
- **`player:{email}`** — Hash per player. Stores `name`, `email`, `score`. Used for deduplication (by email) and Klaviyo calls.
- **`ratelimit:{email}`** — String with 1-hour TTL. Incremented per submission, auto-expires. Max 10 submissions per email per hour.
- **`session:{sessionId}`** — Hash with 10-minute TTL. Stores `startTime` and `used` flag. Created when a game starts, consumed on score submission. Prevents score submissions without a valid game session.

### Caching Strategy

The top 10 leaderboard is edge-cached for 30 seconds via `Cache-Control: s-maxage=30` on the GET endpoint. This means:

- 100k users viewing the leaderboard = ~2 DB reads per minute (cache misses), not 100k
- Score submissions bypass the cache — the POST response returns fresh data directly from Redis
- Submitters always see their own position instantly

## API Design

### `POST /api/start-session`

Called when the game starts. Creates a server-side session that tracks when the game began.

**Request body:** (empty)

**Processing steps:**
1. Generate a random `sessionId` (e.g., `crypto.randomUUID()`)
2. Store in Redis: `session:{sessionId}` → `{ startTime: Date.now(), used: false }` with 10-minute TTL
3. Return the sessionId

**Response:**
```json
{
  "sessionId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

The 10-minute TTL means abandoned sessions clean themselves up. The `used` flag prevents replaying the same session to submit multiple scores.

### `POST /api/submit-score`

**Request body:**
```json
{
  "name": "Kalok2576",
  "email": "kalok@example.com",
  "score": 275,
  "sessionId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "turnstileToken": "xxx"
}
```

**Processing steps (in order):**
1. Validate game session: look up `session:{sessionId}` in Redis — reject if missing (expired/invalid), already used, or started less than 5 seconds ago (impossibly fast game). Mark session as used.
2. Validate Turnstile token with Cloudflare's verify API — reject if bot
3. Rate limit: check `ratelimit:{email}`, reject if >= 10 submissions in the last hour
4. Validate inputs:
   - `name`: max 16 characters, alphanumeric + basic characters, no URLs (reject patterns like `http`, `www`, `.com`)
   - `email`: valid email format
   - `score`: positive integer
5. Write score to Redis sorted set with `ZADD GT` (only updates if new score is higher)
6. Store/update player hash at `player:{email}` with name, email, score
7. Fire-and-forget Klaviyo API call (create/update profile, subscribe to list)
8. Read fresh top 10 + user's rank from Redis
9. Return response

**Response:**
```json
{
  "rank": 4,
  "topTen": [
    { "rank": 1, "name": "JohnyFB", "score": 580 },
    { "rank": 2, "name": "PaulaEEN", "score": 445 },
    ...
  ],
  "userEntry": { "rank": 4, "name": "Kalok2576", "score": 275 }
}
```

**Error responses:**
- `400` — validation failure (bad input, URL in name, invalid format)
- `403` — Turnstile verification failed or invalid/expired/used session
- `429` — rate limit exceeded

### `GET /api/leaderboard`

- Returns top 10 from Redis
- Edge-cached for 30 seconds (`Cache-Control: s-maxage=30`)
- Used when viewing leaderboard from the main menu (without submitting)

**Response:**
```json
{
  "topTen": [
    { "rank": 1, "name": "JohnyFB", "score": 580 },
    ...
  ]
}
```

## Bot Protection & Security

### Game Session Tokens
- When the game starts, the client calls `POST /api/start-session` and receives a `sessionId`
- The session is stored in Redis with a 10-minute TTL and a `used` flag
- On score submission, the server validates: session exists, hasn't been used, and at least 5 seconds have elapsed since game start
- After validation, the session is marked as used (single-use)
- Prevents direct API calls from the console — an attacker would need to start a session first and wait for realistic timing
- Sessions auto-expire after 10 minutes, no cleanup needed

### Cloudflare Turnstile (invisible mode)
- Free widget that runs an invisible challenge in the background while the user fills in the submission form
- Produces a token sent with the submission request
- Server verifies token with Cloudflare's `POST https://challenges.cloudflare.com/turnstile/v0/siteverify`
- No user-facing CAPTCHA — completely invisible

### Rate Limiting
- 10 submissions per email per hour
- Stored in Redis as `ratelimit:{email}` with `INCR` + `EXPIRE 3600`
- Prevents spam even from real humans

### Input Validation
- Username: max 16 characters, alphanumeric + basic characters, reject URL patterns
- Email: format validation
- Score: must be a positive integer

### Deduplication
- By email address (unique identifier)
- Same email submitting again only updates the score if the new one is higher
- Display name can be updated on resubmission

### Edge Caching
- GET leaderboard responses cached at the edge for 30 seconds
- Even a traffic spike on the leaderboard endpoint doesn't hit Redis

## Klaviyo Integration

- **API**: Klaviyo v3 — `POST /api/profiles` to create/update profile, then subscribe to list
- **Profile data**: email, name, custom property `patta_game_score` (best score)
- **Fire-and-forget**: Klaviyo call does not block the response to the user. If it fails, the score is still saved.
- **Segmentation**: Filter in Klaviyo on `patta_game_score` existing (all players) or by score range

## Frontend Flow

### After Game Over → Score Submission Screen
- Shows the user's score in large pixel font
- Username input field (pre-filled from localStorage if returning player)
- Email input field (green placeholder text)
- "Continue" button
- Turnstile widget runs invisibly in the background
- On submit: POST to `/api/submit-score`, transition to leaderboard screen

**Figma reference**: node `45:866`

### After Submission → Leaderboard Screen
- Table with columns: #, Name, Score
- Shows top 10 entries
- User's own row highlighted in blue (even if outside top 10, shown below a separator)
- "Back" button returns to main menu

**Figma reference**: node `45:666`

### From Main Menu → Leaderboard (existing button)
- Hits `GET /api/leaderboard`
- Shows top 10 without user highlight (no submission context)
- "Back" button returns to main menu

### Implementation Notes
- Both screens rendered as DOM elements (like existing menu UI), not on canvas
- Styled with CSS matching the existing pixel-art aesthetic
- View Transitions API for screen changes (consistent with existing transitions)
- Vanilla JS — no framework

## Environment Variables (Vercel)

```
TURNSTILE_SITE_KEY      — public key, embedded in frontend Turnstile widget
TURNSTILE_SECRET_KEY    — secret key, used server-side for token verification
KV_REST_API_URL         — auto-set when linking Vercel KV storage
KV_REST_API_TOKEN       — auto-set when linking Vercel KV storage
KLAVIYO_API_KEY         — from Klaviyo account settings
KLAVIYO_LIST_ID         — the campaign list ID in Klaviyo
```

## Cost Analysis

- **Vercel hosting**: Free tier (100GB bandwidth/month)
- **Vercel Serverless Functions**: Free tier (100K invocations/month) — most leaderboard reads served from edge cache
- **Upstash Redis**: Free tier (10K requests/day) likely sufficient with caching; pay-as-you-go at $0.20/100K requests
- **Cloudflare Turnstile**: Free
- **Klaviyo API**: Included in existing Klaviyo plan

With edge caching, even 100K daily users result in minimal DB requests. Total cost expected: near zero.

## Future Enhancements (Not in Scope)

- Profanity filter for usernames (Dutch + English, likely using `obscenity` package + LDNOOBW word list)
- Social sharing from leaderboard
