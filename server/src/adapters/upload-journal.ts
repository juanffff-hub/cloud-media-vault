import { mkdir, open } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { UploadEvent, UploadJournal } from '../services/upload-journal.js';

export const defaultUploadJournalPath = fileURLToPath(new URL('../../var/upload-journal.jsonl', import.meta.url));

function safeEvent(event: UploadEvent) {
  if (!/^[0-9a-f-]{36}$/i.test(event.operationId) ||
    !/^cloud-media-vault\/[a-zA-Z0-9_/-]+$/.test(event.publicId) || event.publicId.includes('..') ||
    !['image', 'video'].includes(event.resourceType) ||
    !['PREPARED', 'UPLOAD_CONFIRMED', 'PERSISTED', 'COMPENSATED', 'RECONCILIATION_REQUIRED'].includes(event.phase) ||
    (event.recordId && !/^[0-9a-f-]{36}$/i.test(event.recordId)) ||
    (event.reasonCode && !['CLOUD_UPLOAD_FAILED', 'PERSISTENCE_FAILED', 'CLIENT_DISCONNECTED', 'JOURNAL_FAILED', 'TEST_CLEANUP'].includes(event.reasonCode))) {
    throw new Error('Evento de reconciliación inválido.');
  }
  // Lista explícita: no serializar errores, buffers, formularios ni opciones del SDK.
  return { operationId: event.operationId, publicId: event.publicId, resourceType: event.resourceType,
    phase: event.phase, recordId: event.recordId, reasonCode: event.reasonCode, recordedAt: new Date().toISOString() };
}

export function createUploadJournal(path = defaultUploadJournalPath): UploadJournal {
  let queue = Promise.resolve();
  return {
    append(event) {
      const line = JSON.stringify(safeEvent(event)) + '\n';
      const operation = queue.then(async () => {
        await mkdir(dirname(path), { recursive: true });
        const file = await open(path, 'a', 0o600);
        try { await file.writeFile(line, 'utf8'); await file.sync(); }
        finally { await file.close(); }
      });
      queue = operation.catch(() => {});
      return operation;
    },
  };
}
