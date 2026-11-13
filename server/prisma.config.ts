import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';
import { fileURLToPath } from 'node:url';

config({ path: fileURLToPath(new URL('.env', import.meta.url)), quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // Generar/validar el modelo no necesita credenciales. Los scripts de migración
  // exigen una URL directa válida antes de invocar Prisma.
  ...(process.env.DIRECT_URL ? { datasource: { url: process.env.DIRECT_URL } } : {}),
});
