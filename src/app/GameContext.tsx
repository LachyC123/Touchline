import { useLiveQuery } from 'dexie-react-hooks';
import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { setSfxEnabled, setSfxVolume } from '../audio/sfx';
import { freshSeed } from '../domain/rng';
import type { FormationId } from '../domain/formations';
import type { ClubIdentityChoice, OnboardingEvent } from '../domain/club/onboarding';
import type { ClubSave, InjuryTreatment, PendingMatch, SeasonSummary, TipId } from '../domain/save/types';
import type { CardId } from '../game/simulation/cards';
import { getDb, MAIN_SLOT } from '../storage/db';
import { parseSaveFile } from '../storage/exportImport';
import { migrateSave } from '../storage/migrations';
import {
  assignPlayer as repoAssignPlayer,
  autoPickLineup,
  chooseUpgrade as repoChooseUpgrade,
  kickOff as repoKickOff,
  setFormation as repoSetFormation,
  deleteCareer,
  exportCurrentSave,
  loadSettings,
  markInspected,
  markTipSeen,
  onboardingEvent,
  openPack as repoOpenPack,
  replaceSave,
  replayTutorialTips,
  setClubIdentity as repoSetClubIdentity,
  setDeck as repoSetDeck,
  markCardsSeen as repoMarkCardsSeen,
  beginNextSeason as repoBeginNextSeason,
  resolveEvent as repoResolveEvent,
  setCaptain as repoSetCaptain,
  setPenaltyTaker as repoSetPenaltyTaker,
  buyGroundUpgrade as repoBuyGround,
  treatInjuryOnce as repoTreatInjury,
  coverAbsencesInLineup as repoCoverAbsences,
  buyFromMarket as repoBuy,
  haggleInMarket as repoHaggle,
  setTransferListed as repoSetListed,
  answerOffer as repoAnswerOffer,
  claimRoad as repoClaimRoad,
  saveSettings,
  startNewCareer,
  toggleFavourite,
} from '../storage/saveRepo';
import { DEFAULT_SETTINGS, type Settings } from '../storage/schema';
import { askPersistentStorage, flushSaves, forgetCopies, noteSaved } from '../storage/sync';

type SaveState = { status: 'loading' } | { status: 'ready'; save: ClubSave | null } | { status: 'corrupt'; message: string };

interface GameApi {
  saveState: SaveState;
  settings: Settings;
  startCareer: () => Promise<ClubSave>;
  toggleFavourite: (playerId: string) => Promise<void>;
  markInspected: (playerId: string) => Promise<void>;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  exportSave: () => Promise<void>;
  readImportFile: (file: File) => Promise<ClubSave>;
  confirmImport: (save: ClubSave) => Promise<void>;
  resetCareer: () => Promise<void>;
  setFormation: (f: FormationId) => Promise<void>;
  assignPlayer: (slotId: string, playerId: string) => Promise<void>;
  autoPick: () => Promise<void>;
  kickOff: () => Promise<PendingMatch>;
  chooseUpgrade: (playerId: string, level: number, focusId: string) => Promise<void>;
  openPack: (packId: string) => Promise<{ playerId: string; applied: boolean }>;
  onboarding: (event: OnboardingEvent) => Promise<void>;
  seeTip: (tip: TipId) => Promise<void>;
  replayTutorial: () => Promise<void>;
  setClubIdentity: (choice: ClubIdentityChoice) => Promise<void>;
  setDeck: (deck: CardId[]) => Promise<void>;
  markCardsSeen: () => Promise<void>;
  beginNextSeason: () => Promise<SeasonSummary>;
  resolveEvent: (eventId: string, choiceId: string) => Promise<string>;
  setCaptain: (playerId: string | null) => Promise<void>;
  setPenaltyTaker: (playerId: string | null) => Promise<void>;
  upgradeGround: () => Promise<boolean>;
  treatInjury: (injuryId: string, treatment: InjuryTreatment) => Promise<string>;
  coverAbsences: () => Promise<{ inId: string; outId: string | null }[]>;
  buyPlayer: (listingId: string) => Promise<{ playerId: string; applied: boolean }>;
  hagglePlayer: (listingId: string) => Promise<boolean | null>;
  setListed: (playerId: string, listed: boolean) => Promise<void>;
  answerOffer: (offerId: string, accept: boolean) => Promise<string>;
  claimRoad: (at: number) => Promise<{ packId: string | null; coins: number; applied: boolean }>;
}

const GameContext = createContext<GameApi | null>(null);
const LOADING: SaveState = { status: 'loading' };

export function GameProvider({ children }: { children: ReactNode }) {
  // Live queries re-render whenever the IndexedDB rows change (including from another tab).
  const saveState = useLiveQuery<SaveState>(async () => {
    const row = await getDb().saves.get(MAIN_SLOT);
    if (!row) return { status: 'ready', save: null };
    try {
      return { status: 'ready', save: migrateSave(row.save) };
    } catch (err) {
      return { status: 'corrupt', message: err instanceof Error ? err.message : String(err) };
    }
  }, []) ?? LOADING;

  const settings = useLiveQuery(() => loadSettings(), []) ?? DEFAULT_SETTINGS;

  // Every new save is copied (local mirror now, cloud shortly after); flush when hidden.
  const liveSave = saveState.status === 'ready' ? saveState.save : null;
  useEffect(() => {
    if (liveSave) noteSaved(liveSave);
  }, [liveSave]);
  useEffect(() => {
    const flush = () => {
      if (document.visibilityState === 'hidden') flushSaves();
    };
    document.addEventListener('visibilitychange', flush);
    window.addEventListener('pagehide', flushSaves);
    return () => {
      document.removeEventListener('visibilitychange', flush);
      window.removeEventListener('pagehide', flushSaves);
    };
  }, []);

  // Apply presentation settings globally.
  useEffect(() => {
    const root = document.documentElement;
    if (settings.motion === 'system') delete root.dataset.motion;
    else root.dataset.motion = settings.motion;
    root.dataset.contrast = settings.contrast;
    root.dataset.font = settings.fontSize;
    setSfxEnabled(settings.sfx);
    setSfxVolume(settings.sfxVolume);
  }, [settings]);

  const updateSettings = useCallback(async (patch: Partial<Settings>) => {
    const current = await loadSettings();
    await saveSettings({ ...current, ...patch });
  }, []);

  const exportSave = useCallback(async () => {
    const { json, fileName } = await exportCurrentSave();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
    await updateSettings({ lastExportAt: new Date().toISOString() });
  }, [updateSettings]);

  const api = useMemo<GameApi>(
    () => ({
      saveState,
      settings,
      startCareer: async () => {
        const save = await startNewCareer(freshSeed());
        void askPersistentStorage();
        return save;
      },
      toggleFavourite: async (id) => void (await toggleFavourite(id)),
      markInspected: async (id) => void (await markInspected(id)),
      updateSettings,
      exportSave,
      readImportFile: async (file) => parseSaveFile(await file.text()),
      confirmImport: (save) => replaceSave(save),
      resetCareer: async () => {
        await deleteCareer();
        await forgetCopies();
      },
      setFormation: async (f) => void (await repoSetFormation(f)),
      assignPlayer: async (slot, id) => void (await repoAssignPlayer(slot, id)),
      autoPick: async () => void (await autoPickLineup()),
      kickOff: () => repoKickOff(),
      chooseUpgrade: async (id, level, focus) => void (await repoChooseUpgrade(id, level, focus)),
      openPack: (id) => repoOpenPack(id),
      onboarding: async (event) => void (await onboardingEvent(event)),
      seeTip: async (tip) => void (await markTipSeen(tip)),
      replayTutorial: async () => void (await replayTutorialTips()),
      setClubIdentity: async (choice) => void (await repoSetClubIdentity(choice)),
      setDeck: async (deck) => void (await repoSetDeck(deck)),
      markCardsSeen: async () => void (await repoMarkCardsSeen()),
      beginNextSeason: async () => (await repoBeginNextSeason()).summary,
      resolveEvent: async (eventId, choiceId) => (await repoResolveEvent(eventId, choiceId)).outcome,
      setCaptain: async (id) => void (await repoSetCaptain(id)),
      setPenaltyTaker: async (id) => void (await repoSetPenaltyTaker(id)),
      upgradeGround: async () => (await repoBuyGround()).applied,
      treatInjury: async (id, t) => (await repoTreatInjury(id, t)).outcome,
      coverAbsences: () => repoCoverAbsences(),
      buyPlayer: (id) => repoBuy(id),
      hagglePlayer: async (id) => (await repoHaggle(id)).won,
      setListed: async (id, on) => void (await repoSetListed(id, on)),
      answerOffer: async (id, accept) => (await repoAnswerOffer(id, accept)).outcome,
      claimRoad: (at) => repoClaimRoad(at),
    }),
    [saveState, settings, updateSettings, exportSave],
  );

  return <GameContext.Provider value={api}>{children}</GameContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useGame(): GameApi {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used inside GameProvider');
  return ctx;
}

/** Convenience for screens that only render with a career loaded. */
// eslint-disable-next-line react-refresh/only-export-components
export function useSave(): ClubSave {
  const { saveState } = useGame();
  if (saveState.status !== 'ready' || !saveState.save) throw new Error('No career loaded');
  return saveState.save;
}
