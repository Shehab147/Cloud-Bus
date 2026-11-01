import { app } from './app.js';
import { env } from './config/env.js';

const server = app.listen(env.PORT, () => console.log(`Campus Bus API listening on http://localhost:${env.PORT}`));
const shutdown = () => server.close(() => process.exit(0));
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
