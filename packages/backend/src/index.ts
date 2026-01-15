import express, { Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth.js';
import accountRoutes from './routes/account.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cookieParser());

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'gsd-kanban-api' });
});

app.use('/auth', authRoutes);
app.use('/account', accountRoutes);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
