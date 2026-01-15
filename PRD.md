# PRD.md — Simple Team GSD Kanban (Single Board per Account)

## Tasks

### M1 — Auth + Account + Single Board
- [x] Set up project structure (Node.js/TypeScript backend, React frontend)
- [ ] Set up database schema and migrations
- [ ] Implement user signup/login (POST /auth/signup, /auth/login, /auth/logout)
- [ ] Implement GET /me endpoint
- [ ] Create account automatically on signup with single board
- [ ] Implement member invite system (POST /account/invite)
- [ ] Implement join flow for invited members

### M2 — Tasks CRUD + Board UI
- [ ] Implement GET /board endpoint
- [ ] Implement task CRUD endpoints (GET /tasks, POST /tasks, PATCH /tasks/:id, DELETE /tasks/:id)
- [ ] Build board columns UI component
- [ ] Build task card component with tags, priority, due date, assignees
- [ ] Implement task detail modal/drawer
- [ ] Implement task editing (tags, priority, due date, multi-assignees)

### M3 — Drag/Drop + Today Limit
- [ ] Implement drag and drop for tasks across columns
- [ ] Implement drag and drop reordering within columns
- [ ] Implement POST /tasks/:id/move endpoint with Today max 3 validation
- [ ] Add UI message when Today limit is reached

### M4 — Comments + Attachments
- [ ] Implement GET /tasks/:id/comments endpoint
- [ ] Implement POST /tasks/:id/comments endpoint
- [ ] Build comments UI component
- [ ] Set up file storage (S3/R2/MinIO)
- [ ] Implement POST /tasks/:id/attachments endpoint
- [ ] Implement GET /attachments/:id endpoint
- [ ] Implement DELETE /attachments/:id endpoint
- [ ] Build attachments UI with image previews
- [ ] Implement image thumbnail generation

### M5 — Filters + Polish
- [ ] Implement search by title filter
- [ ] Implement filter by assignee
- [ ] Implement filter by tag
- [ ] Add empty states for columns
- [ ] Add loading states
- [ ] Add onboarding hints

## 1) Overview
Build a **small-team** kanban tool inspired by the GSD-style workflow. Each account has **exactly one shared board** where the team captures, prioritizes, and finishes tasks. The board uses a **fixed set of columns**, supports **multiple assignees**, and includes **comments + image/file attachments** with small “ticket-style” previews.

## 2) Product Goals
- Fast task capture (Inbox-first).
- Daily focus with **Today (Max 3)** limit.
- Generic enough for any kind of work via **tags/categories**.
- Team-friendly: invite members, assign tasks to multiple people, discuss in comments, attach files/images.
- Keep MVP **simple to build** (no complex permissions, no advanced automation).

## 3) Target Users
- **Small team** (2–20 users) sharing one board per account.

## 4) Scope (MVP)
### In scope
- Account with members (team).
- **One board per account** (not multiple boards).
- Fixed columns (GSD flow).
- Tasks (cards) with: title, description, tags, priority, due date, multi-assignees.
- Drag & drop across columns + ordering within columns.
- Comments on tasks.
- Attachments on tasks (images viewable as small previews + download/open).
- Filters: by assignee, tag, search by title.

### Out of scope (post-MVP)
- Multiple boards per account.
- Custom workflows/columns.
- Real-time multi-user presence (live cursors). (Normal refresh is fine.)
- Advanced automation rules.
- Time tracking, analytics.
- Integrations (Slack/Gmail/Calendar).

## 5) Core Concepts
### 5.1 Account (Team)
- Represents one customer/team.
- Contains members and the **single** board.

### 5.2 Board (Single)
- Exactly one board per account.
- Fixed columns in this order:
  1) Goals / Projects / Top
  2) Inbox
  3) Today (MAX 3)
  4) Wait / In-Progress (TEMP)
  5) Finished (Archive)
  6) Someday / Maybe

### 5.3 Task (Card)
Minimum fields:
- id
- title (required)
- description (optional)
- column (enum of fixed columns)
- position (number for ordering in the column)
- tags (list of strings)
- priority (enum: Hot / Warm / Normal / Cold)
- due_date (optional)
- assignee_ids (0..N users)
- created_by, created_at, updated_at

### 5.4 Comment
- Task discussion thread
- id, task_id, author_id, body, created_at

### 5.5 Attachment
- Files attached to a task.
- Support images (jpg/png/webp/gif) and generic files (pdf/docx/etc).
- Store:
  - id, task_id, uploader_id
  - original_filename
  - mime_type
  - size_bytes
  - storage_key (where it’s stored)
  - (optional) thumbnail_key (for images)
  - created_at

## 6) Key Rules / Business Logic
### 6.1 Today limit
- “Today” column enforces **max 3 tasks** per board.
- If user moves a 4th task into Today:
  - Block move
  - Show message: “Today is limited to 3 tasks. Move one out first.”
- Limit is fixed at 3 in MVP (no settings UI).

### 6.2 Finished behavior
- Tasks in Finished are still visible.
- Allowed actions:
  - Restore (move out of Finished)
  - Add comment (allowed)
  - Add attachment (allowed)
- Optional: “Archive all finished” (bulk action) — can be postponed if time is tight.

### 6.3 Assignments
- A task can have **multiple assignees**.
- Filter board by assignee (show tasks where selected user is included).

## 7) Primary User Stories
### Team / Account
- As an account owner, I can create an account and invite teammates via email.
- As a member, I can join via invite link or invite token and access the shared board.

### Tasks
- As a user, I can add a task quickly (default to Inbox).
- As a user, I can drag tasks across columns and reorder within a column.
- As a user, I can open a task and edit title/description/tags/priority/due date/assignees.
- As a user, I can move tasks into Today (respecting max 3).

### Comments
- As a user, I can add comments to a task and see a timeline of discussion.

### Attachments
- As a user, I can attach files to a task.
- As a user, I can see image attachments as **small previews** (ticket-style thumbnails).
- As a user, I can click an attachment to open/preview/download.

### Search & Filter
- As a user, I can search tasks by title.
- As a user, I can filter by tag and assignee.

## 8) UX Requirements
### 8.1 Board Screen
- Single main screen: the board with 6 fixed columns.
- Top bar:
  - Search input (title search)
  - Filter by assignee (dropdown)
  - Filter by tag (dropdown or multi-select)
  - “New Task” button

### 8.2 Task Card UI (in columns)
- Shows:
  - Title
  - Assignee avatars/initials (stacked)
  - Tag chips (max 2 visible + “+N”)
  - Due date indicator (if set)
  - Priority indicator (small colored dot/chip)
  - Attachment indicator:
    - If image attachments exist: show 1 tiny thumbnail on the card (optional but nice)
    - Otherwise show a paperclip + count

### 8.3 Task Detail (Drawer/Modal)
Tabs or sections:
- Header: title editable
- Body: description
- Metadata row: tags, priority, due date, assignees
- Attachments section:
  - Grid of small thumbnails for images
  - List for non-images with filename + size
- Comments section:
  - Chronological list + new comment composer

### 8.4 Attachment Preview
- Clicking an image opens a lightbox modal with next/previous.
- Non-image opens in a new tab (or triggers download).

## 9) Permissions (Simple)
Roles:
- Owner
- Member

Owner can:
- Invite/remove members

Members can:
- Create/edit/move tasks
- Comment and add attachments

No advanced permissions in MVP.

## 10) Non-Functional Requirements
- Responsive UI (desktop first; usable on tablet).
- Basic audit fields (created_at/updated_at).
- File upload limits:
  - Max file size: 10MB (configurable later)
  - Allowed mime types: common images + common docs
- Security:
  - Auth required for all endpoints
  - Attachments served via signed URLs or authenticated download endpoint

## 11) Data Model (Suggested)
### Tables
**users**
- id, name, email, password_hash, created_at

**accounts**
- id, name, owner_id, created_at

**account_members**
- account_id, user_id, role, created_at

**board**
- id, account_id (unique), name, created_at

**tasks**
- id, board_id
- title, description
- column (enum)
- position (float/int)
- priority (enum)
- due_date (date)
- created_by, created_at, updated_at

**task_assignees**
- task_id, user_id

**task_tags**
- task_id, tag

**comments**
- id, task_id, author_id, body, created_at

**attachments**
- id, task_id, uploader_id
- original_filename, mime_type, size_bytes
- storage_key, thumbnail_key (nullable)
- created_at

## 12) API Endpoints (Minimal)
### Auth
- POST `/auth/signup`
- POST `/auth/login`
- POST `/auth/logout`
- GET `/me`

### Account / Members
- GET `/account`
- PATCH `/account` (rename)
- POST `/account/invite` { email }
- GET `/account/members`
- DELETE `/account/members/:userId`

### Board (single)
- GET `/board` (returns the single board for the account)

### Tasks
- GET `/tasks?column=&assignee=&tag=&search=`
- POST `/tasks` (default column = Inbox)
- PATCH `/tasks/:id` (edit fields)
- POST `/tasks/:id/move` { to_column, to_position }
  - Enforces Today max 3
- DELETE `/tasks/:id`

### Comments
- GET `/tasks/:id/comments`
- POST `/tasks/:id/comments` { body }

### Attachments
- POST `/tasks/:id/attachments` (multipart upload)
- GET `/attachments/:id` (download / signed url)
- DELETE `/attachments/:id`

## 13) Attachment Storage (Simple)
MVP approach:
- Use S3-compatible storage (AWS S3 / Cloudflare R2 / MinIO).
- Save `storage_key` and serve via:
  - Signed URLs, OR
  - Authenticated proxy endpoint
- For images:
  - Generate `thumbnail_key` (small 200px width) for card/detail preview.
  - If thumbnail generation is too much for MVP, skip thumbnails and use the original image scaled down in UI.

## 14) Acceptance Criteria (MVP)
- Team can sign up, invite members, and access the shared board.
- Board displays fixed columns in correct order.
- Users can create tasks (default Inbox), edit task fields, assign multiple users.
- Drag & drop works for moving and ordering tasks.
- Today column blocks >3 tasks with clear UI message.
- Users can add comments to tasks and see history.
- Users can upload attachments; images show as small previews; files can be opened/downloaded.
- Filters (assignee, tag) and search (title) work.

## 15) Milestones (Simple Build Plan)
### M1 — Auth + Account + Single Board
- Signup/login
- Create account + single board automatically
- Invite members + join flow

### M2 — Tasks CRUD + Board UI
- Board columns UI
- Create/edit/delete tasks
- Tags, priority, due date, multi-assignees

### M3 — Drag/Drop + Today Limit
- Drag/drop move + reorder
- Enforce Today max 3 in backend + UI message

### M4 — Comments + Attachments
- Comments thread
- Upload + list attachments
- Image previews (thumbnail or scaled image)

### M5 — Filters + Polish
- Search + filters
- Empty states, loading states
- Basic onboarding hints (Inbox first, Today max 3)
