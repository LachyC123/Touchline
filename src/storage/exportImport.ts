import type { ClubSave } from '../domain/save/types';
import { migrateSave, SaveFormatError } from './migrations';

export const SAVE_FORMAT = 'touchline-save';

export interface SaveEnvelope {
  format: typeof SAVE_FORMAT;
  schemaVersion: number;
  exportedAt: string;
  checksum: string;
  save: unknown;
}

/** JSON with object keys sorted, so the checksum does not depend on property order. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
}

export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function buildEnvelope(save: ClubSave, nowIso: string): Promise<SaveEnvelope> {
  return {
    format: SAVE_FORMAT,
    schemaVersion: save.schemaVersion,
    exportedAt: nowIso,
    checksum: await sha256Hex(stableStringify(save)),
    save,
  };
}

export async function serialiseSave(save: ClubSave, nowIso: string): Promise<string> {
  return JSON.stringify(await buildEnvelope(save, nowIso), null, 2);
}

const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

/** Defensive parser: size limit, envelope shape, checksum, migration, schema validation. */
export async function parseSaveFile(text: string): Promise<ClubSave> {
  if (text.length > MAX_IMPORT_BYTES) throw new SaveFormatError('That file is too large to be a TOUCHLINE! save.');
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new SaveFormatError('That file is not valid save data (could not read JSON).');
  }
  if (typeof data !== 'object' || data === null || (data as { format?: unknown }).format !== SAVE_FORMAT) {
    throw new SaveFormatError('That file is not a TOUCHLINE! save export.');
  }
  const env = data as Partial<SaveEnvelope>;
  if (typeof env.checksum !== 'string' || env.save === undefined) {
    throw new SaveFormatError('The save export is missing its checksum or data.');
  }
  const actual = await sha256Hex(stableStringify(env.save));
  if (actual !== env.checksum) {
    throw new SaveFormatError('The save file has been changed or damaged since it was exported (checksum mismatch).');
  }
  return migrateSave(env.save);
}
