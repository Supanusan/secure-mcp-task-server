import { app, mcpHandler } from './app.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { env } from './config/env.js';

async function start() {
  try {
    // Do not accept requests before MongoDB is available.
    await connectDatabase();

    const httpServer = app.listen(env.PORT, env.HOST, () => {
      console.log(`MCP endpoint: http://${env.HOST}:${env.PORT}/mcp`);
      console.log(`Health check: http://${env.HOST}:${env.PORT}/health`);
    });

    let shuttingDown = false;
    async function shutdown(signal) {
      if (shuttingDown) return;
      shuttingDown = true;
      console.log(`Received ${signal}; closing server...`);
      httpServer.close(async () => {
        try {
          await mcpHandler.close();
          await disconnectDatabase();
          console.log('Shutdown complete');
          process.exit(0);
        } catch (error) {
          console.error('Shutdown error:', error);
          process.exit(1);
        }
      });
    }

    process.once('SIGINT', () => void shutdown('SIGINT'));
    process.once('SIGTERM', () => void shutdown('SIGTERM'));
  } catch (error) {
    console.error('Failed to start MCP server:', error);
    await disconnectDatabase().catch(() => {});
    process.exitCode = 1;
  }
}

void start();
