import { mkdtemp, readFile, unlink, rmdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, test } from 'vitest';
import { createUploadJournal } from '../src/adapters/upload-journal.js';

test('el diario persiste secuencialmente solo referencias y códigos seguros', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'cloud-media-vault-journal-'));
  const path = join(directory, 'journal.jsonl');
  try {
    const journal = createUploadJournal(path);
    const reference = { operationId: 'ac05701c-7c69-4874-8e26-a24426bf391c', publicId: 'cloud-media-vault/own', resourceType: 'image' as const };
    await Promise.all([journal.append({ ...reference, phase: 'PREPARED' }), journal.append({ ...reference, phase: 'COMPENSATED' })]);
    const rows = (await readFile(path, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
    expect(rows.map(row => row.phase)).toEqual(['PREPARED', 'COMPENSATED']);
    expect(Object.keys(rows[0]).sort()).toEqual(['operationId','phase','publicId','recordedAt','resourceType'].sort());
    expect(() => journal.append({ ...reference, publicId: 'otro-proyecto/asset', phase: 'PREPARED' })).toThrow();
  } finally { await unlink(path).catch(() => {}); await rmdir(directory); }
});
