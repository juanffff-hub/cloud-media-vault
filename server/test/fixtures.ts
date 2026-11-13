export const validEnvironment = {
  NODE_ENV: 'test',
  CLIENT_ORIGIN: 'http://127.0.0.1:5173',
  DATABASE_URL: 'postgresql://test:test@127.0.0.1:5432/cloud_media_vault',
  DIRECT_URL: 'postgresql://test:test@127.0.0.1:5432/cloud_media_vault',
  CLOUDINARY_CLOUD_NAME: 'unit-tests',
  CLOUDINARY_API_KEY: '123456789012345',
  CLOUDINARY_API_SECRET: 'unit-only-not-a-real-secret',
};

export const healthyProbe = async () => ({ status: 'ok' as const, database: 'up' as const });
