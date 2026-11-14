import type { CloudReference } from './cloud-storage.js';

export type UploadPhase = 'PREPARED' | 'UPLOAD_CONFIRMED' | 'PERSISTED' | 'COMPENSATED' | 'RECONCILIATION_REQUIRED';
export type UploadReason = 'CLOUD_UPLOAD_FAILED' | 'PERSISTENCE_FAILED' | 'CLIENT_DISCONNECTED' | 'JOURNAL_FAILED' | 'TEST_CLEANUP';

export interface UploadEvent extends CloudReference {
  operationId: string;
  phase: UploadPhase;
  recordId?: string;
  reasonCode?: UploadReason;
}

export interface UploadJournal {
  append(event: UploadEvent): Promise<void>;
}
