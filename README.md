# CineMax 🎬

Full-stack movie discovery platform using Node.js, Express, SQLite, JWT and bcrypt.

## Features
- Movie catalogue, search and genre filtering
- Movie detail pages/modal
- Registration and login
- Secure password hashing
- JWT authentication
- Personal favorites/watchlist
- SQLite database
- Responsive cinematic UI
- REST API

## Run locally
1. Install Node.js 18+.
2. Run npm install.
3. Copy .env.example to .env and set a strong JWT_SECRET.
4. Run npm start.
5. Open http://localhost:3000.

## API
GET /api/health
GET /api/movies
GET /api/movies/:id
POST /api/auth/register
POST /api/auth/login
GET /api/me
GET /api/favorites
POST /api/favorites/:id
DELETE /api/favorites/:id
