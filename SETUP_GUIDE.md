# GSD Kanban - Project Summary & Setup Guide

## Project Overview

**GSD Kanban** is a small-team task management application inspired by the "Getting Stuff Done" workflow. It features a shared kanban board where teams can capture, prioritize, and complete tasks.

### Key Features
- **Single Board Per Team** - One shared kanban board per account
- **6 Fixed Columns**: Goals, Inbox, Today (max 3), Wait/In-Progress, Finished, Someday
- **Task Management** - Full CRUD with drag-and-drop reordering
- **Rich Descriptions** - Markdown support with inline images
- **Team Collaboration** - Invite members via shareable links
- **File Attachments** - Upload images/files with automatic thumbnails
- **Comments** - Discussion threads on tasks
- **Filters** - Search by title, filter by assignee/tag

### Tech Stack
| Component | Technology |
|-----------|------------|
| Frontend | React 19 + TypeScript + Vite |
| Backend | Node.js + Express + TypeScript |
| Database | PostgreSQL 16 |
| Storage | S3-compatible (MinIO/AWS S3/Cloudflare R2) |
| Auth | JWT tokens in HTTP-only cookies |

---

## Local Development Setup

### Prerequisites
- Node.js 20.x or higher
- npm 10.x or higher
- Docker & Docker Compose (for PostgreSQL & MinIO)

### Step 1: Clone & Install Dependencies
```bash
git clone <repository-url>
cd GSD
npm install
```

### Step 2: Start Database & Storage (Docker)
```bash
docker-compose up -d
```
This starts:
- PostgreSQL on `localhost:5432`
- MinIO on `localhost:9000` (API) and `localhost:9001` (Console)

### Step 3: Setup Environment Variables
Create `packages/backend/.env`:
```env
# Server
PORT=3000

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=gsd_kanban
DB_USER=postgres
DB_PASSWORD=postgres

# JWT Secret (use a strong random string in production!)
JWT_SECRET=your-super-secret-jwt-key-change-in-production

# S3 Storage (MinIO for local dev)
S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin
S3_BUCKET_NAME=gsd-attachments
```

### Step 4: Initialize Database & Storage
```bash
# Create database tables
cd packages/backend
npm run migrate

# Create S3 bucket
npm run setup-storage
```

### Step 5: Start Development Servers
```bash
# From root directory
npm run dev
```
- Frontend: http://localhost:5173
- Backend: http://localhost:3000
- MinIO Console: http://localhost:9001

---

## Railway Deployment Guide

Railway is a platform that makes deploying full-stack apps easy. Here's how to deploy GSD Kanban.

### Step 1: Create Railway Project
1. Go to [railway.app](https://railway.app) and create account
2. Click **"New Project"** → **"Empty Project"**

### Step 2: Add PostgreSQL Database
1. Click **"+ New"** → **"Database"** → **"PostgreSQL"**
2. Railway auto-provisions a PostgreSQL instance
3. Note the connection variables (available in Variables tab)

### Step 3: Add S3-Compatible Storage

**Option A: Use Cloudflare R2 (Recommended - has free tier)**
1. Create Cloudflare account at [cloudflare.com](https://cloudflare.com)
2. Go to R2 → Create bucket named `gsd-attachments`
3. Create API token with R2 read/write permissions
4. Note: Endpoint format is `https://<account-id>.r2.cloudflarestorage.com`

**Option B: Use AWS S3**
1. Create S3 bucket in AWS Console
2. Create IAM user with S3 access
3. Note access key and secret

### Step 4: Deploy Backend

1. In Railway, click **"+ New"** → **"GitHub Repo"**
2. Select your repository
3. Set **Root Directory**: `packages/backend`
4. Set **Build Command**: `npm install && npm run build`
5. Set **Start Command**: `npm run migrate && node dist/index.js`

**Environment Variables for Backend:**
```
PORT=3000
NODE_ENV=production

# Database (Railway provides these automatically if you link the DB)
DB_HOST=${{Postgres.PGHOST}}
DB_PORT=${{Postgres.PGPORT}}
DB_NAME=${{Postgres.PGDATABASE}}
DB_USER=${{Postgres.PGUSER}}
DB_PASSWORD=${{Postgres.PGPASSWORD}}

# JWT - Generate a strong secret!
JWT_SECRET=generate-a-64-char-random-string-here

# S3 Storage (Cloudflare R2 example)
S3_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
S3_REGION=auto
S3_ACCESS_KEY_ID=your-r2-access-key
S3_SECRET_ACCESS_KEY=your-r2-secret-key
S3_BUCKET_NAME=gsd-attachments
```

### Step 5: Deploy Frontend

1. Click **"+ New"** → **"GitHub Repo"**
2. Select same repository
3. Set **Root Directory**: `packages/frontend`
4. Set **Build Command**: `npm install && npm run build`
5. Set **Start Command**: `npx serve dist -s -l 3000`

**Note:** You need to update the frontend to point to the backend URL. Create `packages/frontend/.env.production`:
```
VITE_API_URL=https://your-backend.railway.app
```

And update API calls to use this base URL (or configure Vite proxy for production).

### Step 6: Configure Networking

1. In Backend service → Settings → Networking → Generate Domain
2. In Frontend service → Settings → Networking → Generate Domain
3. Update frontend `VITE_API_URL` with backend domain

---

## Environment Variables Reference

### Backend (Required)

| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `DB_HOST` | PostgreSQL host | `localhost` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `DB_NAME` | Database name | `gsd_kanban` |
| `DB_USER` | Database user | `postgres` |
| `DB_PASSWORD` | Database password | `postgres` |
| `JWT_SECRET` | JWT signing secret (min 32 chars) | `your-secret-key` |
| `S3_ENDPOINT` | S3-compatible endpoint | `http://localhost:9000` |
| `S3_REGION` | S3 region | `us-east-1` |
| `S3_ACCESS_KEY_ID` | S3 access key | `minioadmin` |
| `S3_SECRET_ACCESS_KEY` | S3 secret key | `minioadmin` |
| `S3_BUCKET_NAME` | S3 bucket name | `gsd-attachments` |

### Frontend (Optional)

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API URL (production) | `https://api.example.com` |

---

## Database Schema

The app uses **10 tables**:

| Table | Purpose |
|-------|---------|
| `users` | User accounts (email, password hash) |
| `accounts` | Teams/organizations |
| `account_members` | User-account relationships with roles |
| `boards` | One board per account |
| `tasks` | Kanban tasks with column, position, priority |
| `task_assignees` | Task-user assignments |
| `task_tags` | Task labels/tags |
| `comments` | Task discussion threads |
| `attachments` | File metadata with S3 keys |
| `invites` | Team invitation tokens |

---

## Storage Requirements

The S3-compatible storage is used for:
- **File Attachments** - Any file type up to 10MB
- **Image Thumbnails** - Auto-generated 200px JPEG thumbnails
- **Inline Images** - Images embedded in task descriptions

**Storage Options:**
| Provider | Free Tier | Notes |
|----------|-----------|-------|
| MinIO | Self-hosted | For local dev |
| Cloudflare R2 | 10GB free | No egress fees! |
| AWS S3 | 5GB/12mo | Standard S3 |
| Backblaze B2 | 10GB free | S3-compatible |

---

## Quick Start Commands

```bash
# Development
npm install              # Install all dependencies
docker-compose up -d     # Start PostgreSQL & MinIO
npm run dev              # Start frontend & backend

# Database
cd packages/backend
npm run migrate          # Run migrations
npm run setup-storage    # Create S3 bucket

# Production Build
npm run build            # Build both packages
npm run typecheck        # Check TypeScript types
```

---

## Project Structure

```
GSD/
├── packages/
│   ├── backend/           # Express API server
│   │   ├── src/
│   │   │   ├── index.ts       # Main server entry
│   │   │   ├── db.ts          # PostgreSQL connection
│   │   │   ├── storage.ts     # S3 operations
│   │   │   ├── routes/        # API route handlers
│   │   │   └── middleware/    # Auth middleware
│   │   └── migrations/        # Database migrations
│   │
│   └── frontend/          # React SPA
│       ├── src/
│       │   ├── components/    # React components
│       │   ├── pages/         # Page components
│       │   ├── context/       # React context (auth)
│       │   └── App.tsx        # Main app with routes
│       └── vite.config.ts     # Vite configuration
│
├── docker-compose.yml     # Local dev services
└── package.json           # Root workspace config
```

---

## Troubleshooting

### Database Connection Failed
- Check PostgreSQL is running: `docker ps`
- Verify credentials in `.env` match docker-compose

### S3 Upload Failed
- Check MinIO is running: `docker ps`
- Verify bucket exists: Visit http://localhost:9001
- Check S3 credentials in `.env`

### Frontend Can't Connect to API
- Ensure backend is running on port 3000
- Check Vite proxy config in `vite.config.ts`
- For production, set `VITE_API_URL`

### Migrations Failed
- Ensure database exists: `createdb gsd_kanban`
- Check `DATABASE_URL` or individual DB_* variables
