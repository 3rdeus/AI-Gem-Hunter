/**
 * Service Wrapper with Health Check Server
 * Starts HTTP server for health checks and runs the trading service
 */

require('dotenv').config();

const http = require('http');
const { exec } = require('child_process');

const PORT = process.env.PORT || 3000;

// Choose which service to run
const USE_VELOCITY_HUNTER = process.env.USE_VELOCITY_HUNTER === 'true';
const SERVICE_SCRIPT = USE_VELOCITY_HUNTER 
  ? 'services/velocity-hunter-service.mjs'
  : 'services/gem-hunter-service.mjs';
const SERVICE_NAME = USE_VELOCITY_HUNTER ? 'Velocity Hunter' : 'AI Gem Hunter';

let serviceProcess = null;
let perfTrackerProcess = null;
let serviceStartTime = Date.now();

const fs = require('fs');
const path = require('path');

/**
 * Create HTTP server for health checks and dashboard
 */
function createHealthServer() {
  const server = http.createServer((req, res) => {
    const uptime = Math.floor((Date.now() - serviceStartTime) / 1000);
    
    if (req.url === '/health' || req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'healthy',
        service: SERVICE_NAME,
        uptime: uptime,
        mode: USE_VELOCITY_HUNTER ? 'velocity' : 'legacy',
        timestamp: new Date().toISOString()
      }));
    } else if (req.url === '/dashboard.html' || req.url === '/dashboard') {
      // Serve the dashboard
      const dashboardPath = path.join(__dirname, '..', 'api', 'dashboard.html');
      fs.readFile(dashboardPath, 'utf8', (err, data) => {
        if (err) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Dashboard not found' }));
        } else {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(data);
        }
      });
    } else {
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
 * Start the main trading service
 */
function startMainService() {
  console.log(`🎯 Starting ${SERVICE_NAME}...`);
  console.log(`📜 Script: ${SERVICE_SCRIPT}`);
  
  serviceProcess = exec(`node --experimental-modules ${SERVICE_SCRIPT}`, (error, stdout, stderr) => {
    if (error) {
      console.error(`❌ Service error: ${error.message}`);
      return;
    }
    if (stderr) {
      console.error(`⚠️ Service stderr: ${stderr}`);
    }
  });

  serviceProcess.stdout.on('data', (data) => {
    console.log(data.toString().trim());
  });

  serviceProcess.stderr.on('data', (data) => {
    console.error(data.toString().trim());
  });

  serviceProcess.on('exit', (code) => {
    console.log(`⚠️ ${SERVICE_NAME} exited with code ${code}`);
    // Restart after 5 seconds if it crashes
    setTimeout(() => {
      console.log(`🔄 Restarting ${SERVICE_NAME}...`);
      startMainService();
    }, 5000);
  });

  console.log(`✅ ${SERVICE_NAME} started`);
}

/**
 * Start performance tracker (optional)
 */
function startPerfTrackerService() {
  if (USE_VELOCITY_HUNTER) {
    // Velocity hunter has built-in tracking, skip legacy tracker
    return;
  }
  
  console.log('📊 Starting Performance Tracker Service...');
  
  perfTrackerProcess = exec('node --experimental-modules services/performance-tracker-service.mjs', (error, stdout, stderr) => {
    if (error) {
      console.error(`❌ Perf Tracker error: ${error.message}`);
      return;
    }
  });

  perfTrackerProcess.stdout.on('data', (data) => {
    console.log(`[PERF-TRACKER] ${data.toString().trim()}`);
  });

  perfTrackerProcess.stderr.on('data', (data) => {
    console.error(`[PERF-TRACKER ERROR] ${data.toString().trim()}`);
  });

  perfTrackerProcess.on('exit', (code) => {
    console.log(`⚠️ Performance Tracker exited with code ${code}`);
    setTimeout(() => {
      console.log('🔄 Restarting Performance Tracker...');
      startPerfTrackerService();
    }, 5000);
  });

  console.log('✅ Performance Tracker service started');
}

/**
 * Main entry point
 */
async function main() {
  try {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║                   🎯 ${SERVICE_NAME.padEnd(20)} 🎯                   ║
╠══════════════════════════════════════════════════════════════╣
║  Mode: ${USE_VELOCITY_HUNTER ? 'VELOCITY (Munger/Musk)' : 'LEGACY (Score-based)'}
╚══════════════════════════════════════════════════════════════╝
`);
    
    // Start health check server
    const healthServer = createHealthServer();
    console.log('✅ Health check server started');

    // Start main service
    startMainService();
    
    // Start perf tracker if using legacy mode
    if (!USE_VELOCITY_HUNTER) {
      startPerfTrackerService();
    }
    
    console.log(`💎 ${SERVICE_NAME} is now running!`);

    // Graceful shutdown handlers
    const shutdown = (signal) => {
      console.log(`📴 Received ${signal}, shutting down gracefully...`);
      if (serviceProcess) serviceProcess.kill();
      if (perfTrackerProcess) perfTrackerProcess.kill();
      healthServer.close(() => {
        console.log('👋 Service stopped');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    console.error('❌ Fatal error starting service:', error);
    process.exit(1);
  }
}

main();
