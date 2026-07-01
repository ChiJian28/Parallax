import 'dotenv/config';
import { startServer } from './server/index.js';

startServer().catch((error: unknown) => {
  console.error('Failed to start Parallax gateway:', error);
  process.exit(1);
});
