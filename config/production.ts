export default {
  server: {
    port: process.env.PORT || 8080,
    host: process.env.HOST || '0.0.0.0',
  },
  logging: {
    level: process.env.LOG_LEVEL || 'warn',
    file: process.env.LOG_FILE || 'logs/app.log',
  },
  processing: {
    maxConcurrent: parseInt(process.env.MAX_CONCURRENT_JOBS || '10'),
  },
};
