import { createServer } from 'node:http';

import { createBackendService } from './backend/webApi.js';

const port = Number(process.env.BACKEND_PORT || process.env.PORT || 5000);

const { app: backendApp, attachServer } = createBackendService();
const server = createServer(backendApp);

attachServer(server);

server.listen(port, '0.0.0.0', () => {
  console.log(`TradeBuddy backend listening on http://0.0.0.0:${port}`);
});
