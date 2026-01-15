import express, { Request, Response } from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'gsd-kanban-api' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
