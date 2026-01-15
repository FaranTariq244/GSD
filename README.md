# GSD Kanban

Simple Team GSD Kanban Tool - A small-team kanban application with a single shared board per account.

## Project Structure

This is a monorepo using npm workspaces:

- `packages/backend` - Node.js/TypeScript REST API
- `packages/frontend` - React/TypeScript frontend built with Vite

## Getting Started

### Prerequisites

- Node.js 20.x
- npm 10.x

### Installation

```bash
npm install
```

### Development

Run both backend and frontend in development mode:

```bash
npm run dev
```

Or run them separately:

```bash
# Backend (runs on port 3000)
cd packages/backend
npm run dev

# Frontend (runs on port 5173)
cd packages/frontend
npm run dev
```

### Build

Build both packages:

```bash
npm run build
```

### Type Checking

Run TypeScript type checking across all packages:

```bash
npm run typecheck
```

## Tech Stack

### Backend
- Node.js
- TypeScript
- Express

### Frontend
- React 19
- TypeScript
- Vite

## License

ISC
