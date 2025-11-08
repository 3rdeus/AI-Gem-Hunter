/**
 * Service Wrapper with Health Check Server
 * Starts the gem hunter service and provides HTTP endpoint for DigitalOcean
 */

import { startGemHunter, stopGemHunter, getServiceStats } from './gem-hunter-service.js';
import http from 'http';

const PORT = process.env.PORT || 8080;
let healthServer = null;

/**
 * Create HTTP server for health checks
 */
function createHealthServer( ) {
  const server = http.createServer((req, res ) => {
    // Health check endpoint
    if (req.url === '/health' || req.url === '/') {
      const stats = getServiceStats();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'healthy',
        service: 'AI Gem Hunter',
        ...stats,
        timestamp: new Date().toISOString()
      }));
    }
    // Stats endpoint
    else if (req.url === '/stats') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(getServiceStats()));
    }
    // 404 for other routes
    else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    }
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🏥 Health check server listening on port ${PORT}`);
  });

  return server;
}

/**
 * Main entry point
 */
async function main() {
  console.log('🎯 Initializing AI Gem Hunter Service...');
  
  try {
    // Start health check server first
    healthServer = createHealthServer();
    console.log('✅ Health check server started');

    // Start gem hunter service
    const result = await startGemHunter();
    
    if (result.success) {
      console.log('✅ AI Gem Hunter Service fully initialized');
      console.log('💎 Ready to discover gems!');
    } else {
      console.error('❌ Failed to start Gem Hunter:', result.message);
      process.exit(1);
    }

    // Handle graceful shutdown
    process.on('SIGTERM', () => {
      console.log('📴 Received SIGTERM, shutting down gracefully...');
      stopGemHunter();
      if (healthServer) {
        healthServer.close(() => {
          console.log('👋 Service stopped');
          process.exit(0);
        });
      }
    });

    process.on('SIGINT', () => {
      console.log('📴 Received SIGINT, shutting down gracefully...');
      stopGemHunter();
      if (healthServer) {
        healthServer.close(() => {
          console.log('👋 Service stopped');
          process.exit(0);
        });
      }
    });

  } catch (error) {
    console.error('❌ Fatal error starting service:', error);
    process.exit(1);
  }
}

// Start the service
main();
