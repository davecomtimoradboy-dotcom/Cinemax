# CineMax 🎬

CineMax is a full-stack movie discovery and personal watchlist platform built with **Node.js, Express, SQLite, JWT and bcrypt**.

## What it includes

### Frontend
- Cinematic responsive interface
- Movie search across titles, genres and descriptions
- Genre filtering and sorting
- Featured movie section
- Continue Watching
- Personalized recommendations
- Movie detail pages
- Authorized video/trailer playback
- Playback resume/progress
- Reviews and 1–5 star ratings
- Personal watchlist
- User profile editing
- Dark/light theme
- Mobile navigation
- PWA manifest and service worker

### Backend
- Express REST API
- JWT authentication
- bcrypt password hashing
- SQLite persistence with better-sqlite3
- Helmet security headers
- Rate limiting
- Input validation
- Protected user endpoints
- Protected admin endpoints
- Movie CRUD
- User role management
- Admin statistics
- Review and playback-progress APIs

## Project structure

```
Cinemax/
├── index.html
├── movie.html
├── watchlist.html
├── profile.html
├── admin.html
├── login.html
├── signup.html
├── app.js
├── style.css
├── server.js
├── manifest.json
├── sw.js
├── package.json
├── .env.example
└── .github/workflows/ci.yml
```

## Run locally

1. Install Node.js 18+.
2. Copy `.env.example` to `.env`.
3. Set a strong `JWT_SECRET`.
4. Install dependencies:

```bash
npm install
```

5. Start CineMax:

```bash
npm start
```

6. Open:

```
http://localhost:3000
```

The SQLite database file `cinemax.db` is created automatically.

## Authentication

Registration and login are available from the website.

A newly registered account starts as a normal `user`. To create the first administrator for a local development database, update the role directly in SQLite:

```sql
UPDATE users SET role = 'admin' WHERE email = 'your-email@example.com';
```

After changing the role, log in again so a fresh JWT contains the admin role.

## Main API

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | API health check |
| GET | `/api/movies` | Browse/search movies |
| GET | `/api/movies/:id` | Movie details |
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Sign in |
| GET | `/api/me` | Current user |
| PUT | `/api/profile` | Update profile |
| GET | `/api/favorites` | Get watchlist |
| POST | `/api/favorites/:id` | Add to watchlist |
| DELETE | `/api/favorites/:id` | Remove from watchlist |
| GET | `/api/progress` | Continue Watching |
| GET/POST | `/api/progress/:id` | Read/save playback progress |
| GET | `/api/movies/:id/reviews` | Movie reviews |
| POST | `/api/movies/:id/reviews` | Add/update review |
| GET | `/api/recommendations` | Personalized recommendations |
| GET | `/api/admin/stats` | Admin statistics |
| GET | `/api/admin/users` | Manage users |
| PATCH | `/api/admin/users/:id/role` | Change user role |
| DELETE | `/api/admin/users/:id` | Delete user |
| POST | `/api/admin/movies` | Add movie |
| PUT | `/api/admin/movies/:id` | Edit movie |
| DELETE | `/api/admin/movies/:id` | Delete movie |

## Testing

GitHub Actions automatically runs syntax checks and a basic API health smoke test whenever changes are pushed to `main` or submitted as a pull request.

## Production notes

- Use a strong random `JWT_SECRET`.
- Use a persistent database or managed PostgreSQL when deploying to infrastructure where local SQLite storage is not persistent.
- Only add movie artwork, trailers, and video URLs that you are authorized to use.
- Never commit `.env` or production secrets.
