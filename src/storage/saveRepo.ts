import { advanceOnboarding, applyClubIdentity, type ClubIdentityChoice, type OnboardingEvent } from '../domain/club/onboarding';
import { createCareer } from '../domain/club/newCareer';
import { openPackDraft } from '../domain/packs/packs';
import { assignToSlot, autoLineup, changeFormation } from '../domain/club/lineup';
import type { FormationId } from '../domain/formations';
import { matchArgs, prepareMatch, settleMatch } from '../domain/match/settle';
import { applyFocus, FOCUSES } from '../domain/players/upgrades';
import { seededUuid } from '../domain/rng';
import type { ClubSave, MatchRecord, PendingMatch, TipId } from '../domain/save/types';
import { replayMatch } from '../game/simulation/replay';
import type { MatchCommand } from '../game/simulation/types';
import { getDb, MAIN_SLOT, MAX_BACKUPS, type BackupRow, type TouchlineDB } from './db';
import { migrateSave } from './migrations';
import { DEFAULT_SETTINGS, settingsSchema, type Settings } from './schema';
import { serialiseSave } from './exportImport';

const nowIso = () => new Date().toISOString();

export class StorageUnavailableError extends Error {
  constructor(cause?: unknown) {
    super('Browser storage is unavailable. Private browsing or blocked site data can prevent saving.');
    this.name = 'StorageUnavailableError';
    this.cause = cause;
  }
}

/** Opens IndexedDB, surfacing private-mode / blocked-storage failures as a typed error. */
export async function openStorage(db: TouchlineDB = getDb()): Promise<TouchlineDB> {
  try {
    if (!db.isOpen()) await db.open();
    return db;
  } catch (err) {
    throw new StorageUnavailableError(err);
  }
}

export async function loadSave(db: TouchlineDB = getDb()): Promise<ClubSave | undefined> {
  const row = await db.saves.get(MAIN_SLOT);
  if (!row) return undefined;
  return migrateSave(row.save);
}

async function pushBackup(db: TouchlineDB, reason: BackupRow['reason'], save: unknown): Promise<void> {
  await db.backups.add({ slot: MAIN_SLOT, reason, createdAt: nowIso(), json: JSON.stringify(save) });
  const count = await db.backups.count();
  if (count > MAX_BACKUPS) {
    const oldest = await db.backups.orderBy('id').limit(count - MAX_BACKUPS).primaryKeys();
    await db.backups.bulkDelete(oldest);
  }
}

export async function startNewCareer(careerSeed: string, db: TouchlineDB = getDb()): Promise<ClubSave> {
  const save = createCareer(careerSeed, nowIso());
  const validated = migrateSave(save);
  await db.transaction('rw', db.saves, db.backups, async () => {
    const existing = await db.saves.get(MAIN_SLOT);
    if (existing) await pushBackup(db, 'pre-reset', existing.save);
    await db.saves.put({ slot: MAIN_SLOT, save: validated });
  });
  return validated;
}

export interface MutationResult {
  applied: boolean;
  save: ClubSave;
}

/**
 * The only way game state changes. Runs read → mutate (on a clone) → validate → write inside
 * one IndexedDB transaction, so a crash or double tap can never leave half-applied state.
 * With `claimId`, the mutation is applied at most once per career (idempotency key).
 */
export async function mutateSave(
  mutate: (draft: ClubSave) => void,
  opts: { claimId?: string } = {},
  db: TouchlineDB = getDb(),
): Promise<MutationResult> {
  return db.transaction('rw', db.saves, async () => {
    const row = await db.saves.get(MAIN_SLOT);
    if (!row) throw new Error('No career to update.');
    const current = migrateSave(row.save);
    if (opts.claimId && current.rewardClaimIds.includes(opts.claimId)) return { applied: false, save: current };
    const draft = structuredClone(current);
    mutate(draft);
    if (opts.claimId) draft.rewardClaimIds.push(opts.claimId);
    draft.updatedAt = nowIso();
    const next = migrateSave(draft); // validates invariants; throws (and aborts the tx) if broken
    await db.saves.put({ slot: MAIN_SLOT, save: next });
    return { applied: true, save: next };
  });
}

export function markInspected(playerId: string, db?: TouchlineDB): Promise<MutationResult> {
  return mutateSave((s) => {
    const p = s.footballers[playerId];
    if (p) p.isNew = false;
  }, {}, db);
}

export function toggleFavourite(playerId: string, db?: TouchlineDB): Promise<MutationResult> {
  return mutateSave((s) => {
    const p = s.footballers[playerId];
    if (p) p.favourite = !p.favourite;
  }, {}, db);
}

export async function exportCurrentSave(db: TouchlineDB = getDb()): Promise<{ json: string; fileName: string }> {
  const save = await loadSave(db);
  if (!save) throw new Error('There is no career to export yet.');
  const stamp = nowIso();
  const json = await serialiseSave(save, stamp);
  const slug = save.club.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return { json, fileName: `touchline-${slug}-${stamp.slice(0, 10)}.json` };
}

/** Replaces the current career with an already-validated save, keeping a rolling backup. */
export async function replaceSave(save: ClubSave, db: TouchlineDB = getDb()): Promise<void> {
  const validated = migrateSave(save);
  await db.transaction('rw', db.saves, db.backups, async () => {
    const existing = await db.saves.get(MAIN_SLOT);
    if (existing) await pushBackup(db, 'pre-import', existing.save);
    await db.saves.put({ slot: MAIN_SLOT, save: validated });
  });
}

export async function deleteCareer(db: TouchlineDB = getDb()): Promise<void> {
  await db.transaction('rw', db.saves, db.backups, async () => {
    const existing = await db.saves.get(MAIN_SLOT);
    if (existing) await pushBackup(db, 'pre-reset', existing.save);
    await db.saves.delete(MAIN_SLOT);
  });
}

export async function listBackups(db: TouchlineDB = getDb()): Promise<BackupRow[]> {
  return db.backups.orderBy('id').reverse().toArray();
}

export async function restoreBackup(id: number, db: TouchlineDB = getDb()): Promise<ClubSave> {
  const row = await db.backups.get(id);
  if (!row) throw new Error('That backup no longer exists.');
  const save = migrateSave(JSON.parse(row.json));
  await db.saves.put({ slot: MAIN_SLOT, save });
  return save;
}

export async function loadSettings(db: TouchlineDB = getDb()): Promise<Settings> {
  const row = await db.meta.get('settings');
  const parsed = settingsSchema.safeParse(row?.value);
  return parsed.success ? parsed.data : { ...DEFAULT_SETTINGS };
}

export async function saveSettings(settings: Settings, db: TouchlineDB = getDb()): Promise<void> {
  await db.meta.put({ key: 'settings', value: settingsSchema.parse(settings) });
}

// ---------------------------------------------------------------------------- M1: lineup, matches, upgrades

function assertNoMatchInProgress(s: ClubSave): void {
  if (s.pendingMatch) throw new Error('Finish the current match before changing the lineup.');
}

/** The first-run flow moves on once the first signing is in the starting seven. */
function checkRecruitPlaced(s: ClubSave): void {
  if (s.onboarding !== 'lineup') return;
  const signing = s.packs.find((p) => p.kind === 'first-signing')?.playerId;
  if (signing && Object.values(s.lineup).includes(signing)) s.onboarding = advanceOnboarding(s.onboarding, 'recruitPlaced');
}

export function setFormation(formation: FormationId, db?: TouchlineDB): Promise<MutationResult> {
  return mutateSave((s) => {
    assertNoMatchInProgress(s);
    s.lineup = changeFormation(s.lineup, formation, s.footballers, s.squadIds);
    s.formationId = formation;
  }, {}, db);
}

export function assignPlayer(slotId: string, playerId: string, db?: TouchlineDB): Promise<MutationResult> {
  return mutateSave((s) => {
    assertNoMatchInProgress(s);
    s.lineup = assignToSlot(s.lineup, s.formationId, slotId, playerId, s.footballers);
    checkRecruitPlaced(s);
  }, {}, db);
}

export function autoPickLineup(db?: TouchlineDB): Promise<MutationResult> {
  return mutateSave((s) => {
    assertNoMatchInProgress(s);
    const players = s.squadIds.map((id) => s.footballers[id]).filter((p): p is NonNullable<typeof p> => Boolean(p));
    s.lineup = autoLineup(players, s.formationId);
    checkRecruitPlaced(s);
  }, {}, db);
}

/** Freezes lineups + seed and persists the pending match before a ball is kicked. */
export async function kickOff(db?: TouchlineDB): Promise<PendingMatch> {
  const { save } = await mutateSave((s) => {
    if (!s.pendingMatch) s.pendingMatch = prepareMatch(s);
  }, {}, db);
  if (!save.pendingMatch) throw new Error('Could not start the match.');
  return save.pendingMatch;
}

export function recordCommand(matchId: string, command: MatchCommand, db?: TouchlineDB): Promise<MutationResult> {
  return mutateSave((s) => {
    const pm = s.pendingMatch;
    if (!pm || pm.matchId !== matchId) throw new Error('That match is no longer in progress.');
    if (!pm.commands.some((c) => c.tick === command.tick && c.type === command.type && c.side === command.side)) {
      pm.commands.push({ ...command });
      pm.commands.sort((a, b) => a.tick - b.tick);
    }
    pm.checkpointTick = Math.max(pm.checkpointTick, command.tick);
  }, {}, db);
}

export function saveCheckpoint(matchId: string, tick: number, db?: TouchlineDB): Promise<MutationResult> {
  return mutateSave((s) => {
    const pm = s.pendingMatch;
    if (pm && pm.matchId === matchId && Number.isInteger(tick) && tick > pm.checkpointTick) pm.checkpointTick = tick;
  }, {}, db);
}

/**
 * Settles the pending match exactly once. The result is re-derived from seed + recorded
 * commands inside the transaction — the UI's copy is never trusted for rewards.
 */
export async function settleMatchOnce(matchId: string, db?: TouchlineDB): Promise<{ record: MatchRecord; applied: boolean }> {
  let record: MatchRecord | undefined;
  const r = await mutateSave(
    (s) => {
      const pm = s.pendingMatch;
      if (!pm || pm.matchId !== matchId) throw new Error('That match is no longer in progress.');
      const result = replayMatch(matchArgs(pm), pm.commands);
      record = settleMatch(s, pm, result);
    },
    { claimId: `match:${matchId}` },
    db,
  );
  record ??= r.save.matchRecords.find((m) => m.matchId === matchId);
  if (!record) throw new Error('Match record missing.');
  return { record, applied: r.applied };
}

export function chooseUpgrade(playerId: string, level: number, focusId: string, db?: TouchlineDB): Promise<MutationResult> {
  return mutateSave(
    (s) => {
      const idx = s.pendingUpgrades.findIndex((u) => u.playerId === playerId && u.level === level);
      const pending = s.pendingUpgrades[idx];
      if (!pending) throw new Error('That upgrade has already been used.');
      if (!pending.options.includes(focusId)) throw new Error('That training focus is not available.');
      const p = s.footballers[playerId];
      if (!p) throw new Error('Unknown player.');
      const { before, after } = applyFocus(p, focusId);
      p.history.push({
        id: seededUuid(`${s.careerSeed}:history:${s.nextSeq}`),
        kind: 'upgrade',
        season: s.season,
        order: s.nextSeq,
        headline: `RISING STAR: level ${level} — ${FOCUSES[focusId]?.name ?? focusId} training${after > before ? ` (OVR ${before} → ${after})` : ''}.`,
      });
      s.nextSeq++;
      s.pendingUpgrades.splice(idx, 1);
      if (!s.tipsSeen.includes('upgrade')) s.tipsSeen.push('upgrade');
    },
    { claimId: `upgrade:${playerId}:${level}` },
    db,
  );
}

// ---------------------------------------------------------------------------- M2: packs, onboarding, identity

/**
 * Opens a pack exactly once (claim id = pack id). The recruit was committed when the pack was
 * granted; this moves that exact player into the squad before any reveal animation starts.
 */
export async function openPack(packId: string, db?: TouchlineDB): Promise<{ playerId: string; applied: boolean }> {
  let playerId = '';
  const r = await mutateSave(
    (s) => {
      const kind = s.packs.find((p) => p.id === packId)?.kind;
      playerId = openPackDraft(s, packId).id;
      if (kind === 'first-signing') s.onboarding = advanceOnboarding(s.onboarding, 'packOpened');
    },
    { claimId: `pack:${packId}` },
    db,
  );
  if (!r.applied) playerId = r.save.packs.find((p) => p.id === packId)?.playerId ?? '';
  if (!playerId) throw new Error('That pack could not be opened.');
  return { playerId, applied: r.applied };
}

export function onboardingEvent(event: OnboardingEvent, db?: TouchlineDB): Promise<MutationResult> {
  return mutateSave((s) => {
    s.onboarding = advanceOnboarding(s.onboarding, event);
  }, {}, db);
}

export function markTipSeen(tip: TipId, db?: TouchlineDB): Promise<MutationResult> {
  return mutateSave((s) => {
    if (!s.tipsSeen.includes(tip)) s.tipsSeen.push(tip);
  }, {}, db);
}

/** Replaying the tutorial brings back its coach marks; earned rewards are never re-granted. */
export function replayTutorialTips(db?: TouchlineDB): Promise<MutationResult> {
  return mutateSave((s) => {
    s.tipsSeen = [];
  }, {}, db);
}

export function setClubIdentity(choice: ClubIdentityChoice, db?: TouchlineDB): Promise<MutationResult> {
  return mutateSave((s) => {
    const next = applyClubIdentity(s.club, choice);
    s.club = { ...s.club, ...next };
    s.onboarding = advanceOnboarding(s.onboarding, 'clubNamed');
  }, {}, db);
}
