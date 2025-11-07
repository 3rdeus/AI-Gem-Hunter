/**
 * Logging Utility
 * Structured logging without exposing sensitive information
 */

/**
 * Log levels
 */
export const LogLevel = {
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR',
};

/**
 * Sanitize data to remove sensitive information
 */
function sanitize(data) {
  if (typeof data !== 'object' || data === null) {
    return data;
  }

  const sanitized = { ...data };
  const sensitiveKeys = ['api_key', 'apiKey', 'token', 'password', 'secret', 'authorization'];

  for (const key in sanitized) {
    if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof sanitized[key] === 'object') {
      sanitized[key] = sanitize(sanitized[key]);
    }
  }

  return sanitized;
}

/**
 * Format log entry
 */
function formatLog(level, message, data = {}) {
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...sanitize(data),
  };
}

/**
 * Log functions
 */
export function debug(message, data) {
  if (process.env.NODE_ENV === 'development') {
    console.log(JSON.stringify(formatLog(LogLevel.DEBUG, message, data)));
  }
}

export function info(message, data) {
  console.log(JSON.stringify(formatLog(LogLevel.INFO, message, data)));
}

export function warn(message, data) {
  console.warn(JSON.stringify(formatLog(LogLevel.WARN, message, data)));
}

export function error(message, err, data = {}) {
  const errorData = {
    ...data,
    error: {
      message: err?.message,
      stack: process.env.NODE_ENV === 'development' ? err?.stack : undefined,
      code: err?.code,
      status: err?.status,
    },
  };
  
  console.error(JSON.stringify(formatLog(LogLevel.ERROR, message, errorData)));
}

/**
 * Request logger middleware
 */
export function logRequest(req, duration, status) {
  info('API Request', {
    method: req.method,
    path: req.url,
    status,
    duration_ms: duration,
    user_agent: req.headers['user-agent'],
    ip: req.headers['x-forwarded-for'] || req.connection?.remoteAddress,
  });
}

/**
 * Performance logger
 */
export function logPerformance(operation, duration, metadata = {}) {
  info('Performance', {
    operation,
    duration_ms: duration,
    ...metadata,
  });
}
