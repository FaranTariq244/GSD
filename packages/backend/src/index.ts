import dotenv from 'dotenv';
import express, { Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth.js';
import accountRoutes from './routes/account.js';
import boardRoutes from './routes/board.js';
import tasksRoutes from './routes/tasks.js';
import commentsRoutes from './routes/comments.js';
import attachmentsRoutes from './routes/attachments.js';
import projectsRoutes from './routes/projects.js';
import tagsRoutes from './routes/tags.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cookieParser());

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'gsd-kanban-api' });
});

app.use('/api/auth', authRoutes);
app.use('/api/account', accountRoutes);
app.use('/api/board', boardRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/tags', tagsRoutes);
app.use('/api', commentsRoutes);
app.use('/api', attachmentsRoutes);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
