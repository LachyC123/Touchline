import { useMemo, useState, type CSSProperties } from 'react';
import { useSave } from '../../app/GameContext';
import { navigate } from '../../app/router';
import { FootballerCard } from '../../components/cards/FootballerCard';
import { Icon } from '../../components/icons/Icon';
import { squadPower } from '../../domain/club/newCareer';
import { overall } from '../../domain/players/rating';
import { POSITIONS, type Footballer, type Position } from '../../domain/players/types';
import { playSfx } from '../../audio/sfx';
import './squad.css';

type SortKey = 'rating' | 'potential' | 'age';
const POSITION_ORDER: Record<Position, number> = { GK: 0, DEF: 1, MID: 2, FWD: 3 };

function readPref<T extends string>(key: string, fallback: T, allowed: readonly T[]): T {
  try {
    const v = sessionStorage.getItem(key) as T | null;
    return v && allowed.includes(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

function writePref(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* storage may be unavailable; preference is cosmetic */
  }
}

export function SquadScreen() {
  const save = useSave();
  const [filter, setFilter] = useState<Position | 'ALL'>(() => readPref('squad.filter', 'ALL', ['ALL', ...POSITIONS]));
  const [sort, setSort] = useState<SortKey>(() => readPref('squad.sort', 'rating', ['rating', 'potential', 'age']));
  const starters = useMemo(() => new Set(Object.values(save.lineup)), [save.lineup]);

  const players = useMemo(() => {
    const list = save.squadIds.map((id) => save.footballers[id]).filter((p): p is Footballer => Boolean(p));
    const filtered = filter === 'ALL' ? list : list.filter((p) => p.primaryPosition === filter);
    const key = (p: Footballer) => (sort === 'rating' ? overall(p) : sort === 'potential' ? p.potential : -p.age);
    return filtered.sort((a, b) => key(b) - key(a) || POSITION_ORDER[a.primaryPosition] - POSITION_ORDER[b.primaryPosition] || a.lastName.localeCompare(b.lastName));
  }, [save, filter, sort]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: save.squadIds.length };
    for (const id of save.squadIds) {
      const pos = save.footballers[id]?.primaryPosition;
      if (pos) c[pos] = (c[pos] ?? 0) + 1;
    }
    return c;
  }, [save]);

  return (
    <main className="screen squad">
      <header className="screen-head">
        <h1>
          <small>{save.club.name}</small>
          Squad
        </h1>
        <div className="squad__power" aria-label={`Team power ${squadPower(save)}`}>
          <span>Team power</span>
          <b>{squadPower(save).toFixed(1)}</b>
        </div>
      </header>

      <div className="chips" role="group" aria-label="Filter by position">
        {(['ALL', ...POSITIONS] as const).map((f) => (
          <button
            key={f}
            type="button"
            className="chip"
            aria-pressed={filter === f}
            onClick={() => {
              playSfx('tap');
              setFilter(f);
              writePref('squad.filter', f);
            }}
          >
            {f} <span className="squad__count">{counts[f] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="squad__sort">
        <Icon name="sort" size={18} />
        <div className="segmented" role="group" aria-label="Sort players">
          {(['rating', 'potential', 'age'] as const).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={sort === s}
              onClick={() => {
                playSfx('tap');
                setSort(s);
                writePref('squad.sort', s);
              }}
            >
              {s === 'age' ? 'Youngest' : s}
            </button>
          ))}
        </div>
      </div>

      {players.length === 0 ? (
        <div className="squad__empty paper">
          <p className="display">No {filter} players in the squad</p>
        </div>
      ) : (
        <ul className="squad__grid" aria-label="Players">
          {players.map((p, i) => (
            <li key={p.id} style={{ '--i': i } as CSSProperties}>
              <FootballerCard player={p} kit={save.club.kit} variant="standard" onActivate={() => navigate({ name: 'player', id: p.id })} />
              {starters.has(p.id) && (
                <span className="squad__starter" title="In the starting seven">
                  <Icon name="shirt" size={14} /> Starter
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
