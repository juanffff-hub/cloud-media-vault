export type Environment = Readonly<{
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  CLIENT_ORIGIN: string;
  MAX_FILE_SIZE_BYTES: number;
  DATABASE_URL: string;
  DIRECT_URL: string;
  CLOUDINARY_CLOUD_NAME: string;
  CLOUDINARY_API_KEY: string;
  CLOUDINARY_API_SECRET: string;
  CLOUDINARY_FOLDER: string;
  CLOUDINARY_TIMEOUT_MS: number;
}>;

export class ConfigurationError extends Error {
  constructor(public readonly fields: string[]) {
    super(`Configuración inválida. Revisa: ${fields.join(', ')}.`);
    this.name = 'ConfigurationError';
  }
}

export function readEnvironment(source: NodeJS.ProcessEnv): Environment {
  const invalid = new Set<string>();
  const required = (key: string) => {
    const value = source[key]?.trim() ?? '';
    if (!value || /^(replace|your_|changeme|pendiente)/i.test(value)) invalid.add(key);
    return value;
  };
  const integer = (key: string, fallback: string, min: number, max: number) => {
    const raw = source[key] ?? fallback;
    const value = Number(raw);
    if (!/^\d+$/.test(raw) || !Number.isSafeInteger(value) || value < min || value > max) invalid.add(key);
    return value;
  };
  const databaseUrl = (key: string) => {
    const value = required(key);
    try {
      const url = new URL(value);
      if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || url.pathname.length < 2) invalid.add(key);
    } catch { invalid.add(key); }
    return value;
  };

  const nodeEnv = source.NODE_ENV ?? 'development';
  if (!['development', 'test', 'production'].includes(nodeEnv)) invalid.add('NODE_ENV');
  const origin = required('CLIENT_ORIGIN');
  try {
    const url = new URL(origin);
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin) invalid.add('CLIENT_ORIGIN');
  } catch { invalid.add('CLIENT_ORIGIN'); }

  const environment: Environment = {
    NODE_ENV: nodeEnv as Environment['NODE_ENV'],
    PORT: integer('PORT', '3001', 1, 65535),
    CLIENT_ORIGIN: origin,
    MAX_FILE_SIZE_BYTES: integer('MAX_FILE_SIZE_MB', '10', 10, 10) * 1024 * 1024,
    DATABASE_URL: databaseUrl('DATABASE_URL'),
    DIRECT_URL: databaseUrl('DIRECT_URL'),
    CLOUDINARY_CLOUD_NAME: required('CLOUDINARY_CLOUD_NAME'),
    CLOUDINARY_API_KEY: required('CLOUDINARY_API_KEY'),
    CLOUDINARY_API_SECRET: required('CLOUDINARY_API_SECRET'),
    CLOUDINARY_FOLDER: source.CLOUDINARY_FOLDER ?? 'cloud-media-vault',
    CLOUDINARY_TIMEOUT_MS: integer('CLOUDINARY_TIMEOUT_MS', '30000', 1000, 120000),
  };
  if (!/^[a-zA-Z0-9_-]+$/.test(environment.CLOUDINARY_CLOUD_NAME)) invalid.add('CLOUDINARY_CLOUD_NAME');
  if (!/^\d+$/.test(environment.CLOUDINARY_API_KEY)) invalid.add('CLOUDINARY_API_KEY');
  if (!/^cloud-media-vault(?:\/[a-zA-Z0-9_-]+)*$/.test(environment.CLOUDINARY_FOLDER)) invalid.add('CLOUDINARY_FOLDER');
  if (invalid.size) throw new ConfigurationError([...invalid]);
  return Object.freeze(environment);
}
