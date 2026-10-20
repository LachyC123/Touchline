# TOUCHLINE! balance report

- Engine: `engine-1`
- Matches per scenario: 1000 (home/away alternated, fixed seeds)
- Generated in 181.3s on 2026-10-20
- Key constants: tactic 12' active / 18' cooldown; 12 ticks per minute; shot range 52 units.

## Equal teams

| Scenario (focus team) | Win | Draw | Loss | GF | GA | Shots | xG | xGA | Poss | Passes | Pass % | Tackles won | Turnovers won / lost | End stamina |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Mirror (55 vs same 55) | 34.5% | 31.6% | 33.9% | 1.06 | 1.03 | 4.2 | 1.14 | 1.15 | 50.1% | 37.9 | 74.5% | 3.5 | 7.2 / 7.3 | 0.83 |

Mean match length: 1205 ticks = 121 s of football at 1× (plus goal/halftime presentation pauses).

## Power gaps (stronger team's view)

| Scenario (focus team) | Win | Draw | Loss | GF | GA | Shots | xG | xGA | Poss | Passes | Pass % | Tackles won | Turnovers won / lost | End stamina |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Stronger by 4 OVR | 45.5% | 28.9% | 25.6% | 1.31 | 0.98 | 4.4 | 1.36 | 1.00 | 51.3% | 39.7 | 75.8% | 2.9 | 6.8 / 6.6 | 0.84 |
| Stronger by 8 OVR | 50.9% | 28.6% | 20.5% | 1.36 | 0.83 | 5.0 | 1.47 | 0.86 | 52.2% | 39.3 | 75.0% | 4.5 | 8.2 / 7.3 | 0.85 |
| Stronger by 12 OVR | 64.7% | 24.0% | 11.3% | 1.51 | 0.58 | 5.3 | 1.64 | 0.66 | 52.1% | 39.2 | 77.0% | 3.9 | 8.0 / 6.4 | 0.84 |
| Stronger by 18 OVR | 74.0% | 17.6% | 8.4% | 1.85 | 0.52 | 6.2 | 2.06 | 0.56 | 54.2% | 40.9 | 78.5% | 4.4 | 8.5 / 6.0 | 0.84 |

## Formations

| Scenario (focus team) | Win | Draw | Loss | GF | GA | Shots | xG | xGA | Poss | Passes | Pass % | Tackles won | Turnovers won / lost | End stamina |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 3-2-1 Fortress vs 2-2-2 | 32.4% | 33.1% | 34.5% | 0.97 | 1.04 | 5.2 | 0.98 | 1.18 | 52.3% | 39.3 | 78.9% | 1.9 | 5.3 / 5.2 | 0.83 |
| 2-2-2 Balanced vs 2-2-2 (control) | 32.3% | 32.2% | 35.5% | 1.13 | 1.16 | 4.5 | 1.21 | 1.21 | 50.0% | 38.7 | 75.7% | 2.1 | 6.0 / 5.9 | 0.82 |

## Tactics (chip re-used whenever ready)

| Scenario (focus team) | Win | Draw | Loss | GF | GA | Shots | xG | xGA | Poss | Passes | Pass % | Tackles won | Turnovers won / lost | End stamina |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| No chips (control) | 34.5% | 31.6% | 33.9% | 1.06 | 1.03 | 4.2 | 1.14 | 1.15 | 50.1% | 37.9 | 74.5% | 3.5 | 7.2 / 7.3 | 0.83 |
| PRESS whenever ready | 46.4% | 32.3% | 21.3% | 1.10 | 0.72 | 4.4 | 1.16 | 0.77 | 47.8% | 34.8 | 74.5% | 5.2 | 8.8 / 7.8 | 0.72 |
| QUICK PASS whenever ready | 29.7% | 33.1% | 37.2% | 0.94 | 1.06 | 3.7 | 1.05 | 1.15 | 51.4% | 47.8 | 74.9% | 3.1 | 6.9 / 7.2 | 0.84 |

## How to read this
- *Mirror* checks engine fairness: the same team against itself should split wins and losses evenly.
- *Power gaps* should show a clear, rising edge for the stronger team without guaranteed wins.
- *Tactics*: PRESS should raise tackles/turnovers won and lower end stamina; QUICK PASS should raise pass volume.
