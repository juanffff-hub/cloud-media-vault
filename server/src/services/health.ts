import { HttpError } from '../middleware/errors.js';

export type HealthCheck = () => Promise<{ status: 'ok'; database: 'up' }>;

export function createHealthCheck(probe: () => Promise<void>): HealthCheck {
  return async () => {
    try {
      await probe();
      return { status: 'ok', database: 'up' };
    } catch {
      throw new HttpError(500, 'DATABASE_UNAVAILABLE', 'La base de datos no está disponible.');
    }
  };
}
