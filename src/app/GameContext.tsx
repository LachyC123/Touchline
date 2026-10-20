import { useLiveQuery } from 'dexie-react-hooks';
import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { setSfxEnabled, setSfxVolume } from '../audio/sfx';
import { freshSeed } from '../domain/rng';
import type { FormationId } from '../domain/formations';
import type { ClubSave, PendingMatch } from '../domain/save/types';
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
  replaceSave,
  saveSettings,
  startNewCareer,
  toggleFavourite,
} from '../storage/saveRepo';
import { DEFAULT_SETTINGS, type Settings } from '../storage/schema';

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
      startCareer: () => startNewCareer(freshSeed()),
      toggleFavourite: async (id) => void (await toggleFavourite(id)),
      markInspected: async (id) => void (await markInspected(id)),
      updateSettings,
      exportSave,
      readImportFile: async (file) => parseSaveFile(await file.text()),
      confirmImport: (save) => replaceSave(save),
      resetCareer: () => deleteCareer(),
      setFormation: async (f) => void (await repoSetFormation(f)),
      assignPlayer: async (slot, id) => void (await repoAssignPlayer(slot, id)),
      autoPick: async () => void (await autoPickLineup()),
      kickOff: () => repoKickOff(),
      chooseUpgrade: async (id, level, focus) => void (await repoChooseUpgrade(id, level, focus)),
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
