export default {
  server: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || 'localhost',
  },
  database: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/minecraft-mod-converter',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || 'logs/app.log',
  },
  llm: {
    apiKey: process.env.LLM_API_KEY || '',
    endpoint: process.env.LLM_ENDPOINT || '',
    model: process.env.LLM_MODEL || 'gpt-4',
  },
  github: {
    token: process.env.GITHUB_TOKEN || '',
  },
  processing: {
    maxConcurrent: parseInt(process.env.MAX_CONCURRENT_JOBS || '5'),
  },
};
