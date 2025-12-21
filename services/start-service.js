/**
 * Service Wrapper with Health Check Server
 * Starts HTTP server for DigitalOcean health checks and runs gem hunter service
 */

const http = require('http');
const { exec } = require('child_process');

const PORT = process.env.PORT || 8080;
let serviceProcess = null;
let serviceStartTime = Date.now();

/**
 * Create HTTP server for health checks
 */
function createHealthServer() {
  const server = http.createServer((req, res) => {
    const uptime = Math.floor((Date.now() - serviceStartTime) / 1000);
    
    // Health check endpoint
    if (req.url === '/health' || req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'healthy',
        service: 'AI Gem Hunter',
        uptime: uptime,
        timestamp: new Date().toISOString()
      }));
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
 * Start the gem hunter service as a child process
 */
function startGemHunterService() {
  console.log('🎯 Starting AI Gem Hunter Service...');
  
  // Start the service in the background
  serviceProcess = exec('node --experimental-modules services/gem-hunter-service.mjs', (error, stdout, stderr) => {
    if (error) {
      console.error(`❌ Service error: ${error.message}`);
      return;
    }
    if (stderr) {
      console.error(`⚠️ Service stderr: ${stderr}`);
    }
    console.log(`📝 Service output: ${stdout}`);
  });

  // Forward service output to console
  serviceProcess.stdout.on('data', (data) => {
    console.log(`[GEM-HUNTER] ${data.toString().trim()}`);
  });

  serviceProcess.stderr.on('data', (data) => {
    console.error(`[GEM-HUNTER ERROR] ${data.toString().trim()}`);
  });

  serviceProcess.on('exit', (code) => {
    console.log(`⚠️ Gem Hunter service exited with code ${code}`);
    // Restart after 5 seconds if it crashes
    setTimeout(() => {
      console.log('🔄 Restarting Gem Hunter service...');
      startGemHunterService();
    }, 5000);
  });

  console.log('✅ Gem Hunter service started');

  let perfTrackerProcess = null;

/**
 * Start the performance tracker service
 */
function startPerfTrackerService() {
  console.log('📊 Starting Performance Tracker Service...');
  
  perfTrackerProcess = exec('node --experimental-modules services/performance-tracker-service.mjs', (error, stdout, stderr) => {
    if (error) {
      console.error(`❌ Perf Tracker error: ${error.message}`);
      return;
    }
    if (stderr) {
      console.error(`⚠️ Perf Tracker stderr: ${stderr}`);
    }
    console.log(`📝 Perf Tracker output: ${stdout}`);
  });

  perfTrackerProcess.stdout.on('data', (data) => {
    console.log(`[PERF-TRACKER] ${data.toString().trim()}`);
  });

  perfTrackerProcess.stderr.on('data', (data) => {
    console.error(`[PERF-TRACKER ERROR] ${data.toString().trim()}`);
  });

  perfTrackerProcess.on('exit', (code) => {
    console.log(`⚠️ Performance Tracker exited with code ${code}`);
    // Restart after 5 seconds if it crashes
    setTimeout(() => {
      console.log('🔄 Restarting Performance Tracker...');
      startPerfTrackerService();
    }, 5000);
  });

  console.log('✅ Performance Tracker service started');
}
}

/**
 * Main entry point
 */
async function main() {
  try {
    console.log('🎯 Initializing AI Gem Hunter Service...');
    
    // Start health check server
    const healthServer = createHealthServer();
    console.log('✅ Health check server started');

    // Start gem hunter service
    startGemHunterService();
        startPerfTrackerService();
    
    console.log('💎 AI Gem Hunter is now running!');

    // Handle graceful shutdown
    process.on('SIGTERM', () => {
      console.log('📴 Received SIGTERM, shutting down gracefully...');
      if (serviceProcess) {
              if (perfTrackerProcess) {
                        perfTrackerProcess.kill();
                      }
        serviceProcess.kill();
      }
      healthServer.close(() => {
        console.log('👋 Service stopped');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      console.log('📴 Received SIGINT, shutting down gracefully...');
      if (serviceProcess) {
              if (perfTrackerProcess) {
        perfTrackerProcess.kill();
      }
        serviceProcess.kill();
      }
      healthServer.close(() => {
        console.log('👋 Service stopped');
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('❌ Fatal error starting service:', error);
    process.exit(1);
  }
}

// Start the service
main();
