# TOUCHLINE! balance report

- Engine: `engine-2`
- Matches per scenario: 1000 (home/away alternated, fixed seeds)
- Generated in 183.0s on 2026-10-21
- Key constants: tactic 12' active / 18' cooldown; 12 ticks per minute; shot range 52 units.

## Equal teams

| Scenario (focus team) | Win | Draw | Loss | GF | GA | Shots | xG | xGA | Poss | Passes | Pass % | Tackles won | Turnovers won / lost | End stamina |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Mirror (55 vs same 55) | 36.1% | 26.6% | 37.3% | 1.30 | 1.31 | 4.4 | 1.38 | 1.41 | 49.9% | 36.0 | 73.9% | 2.8 | 5.6 / 5.6 | 0.84 |

Mean match length: 1237 ticks = 124 s of football at 1× (plus goal/halftime presentation pauses).

## Power gaps (stronger team's view)

| Scenario (focus team) | Win | Draw | Loss | GF | GA | Shots | xG | xGA | Poss | Passes | Pass % | Tackles won | Turnovers won / lost | End stamina |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Stronger by 4 OVR | 44.9% | 26.2% | 28.9% | 1.50 | 1.19 | 4.6 | 1.62 | 1.23 | 50.6% | 37.0 | 75.1% | 2.3 | 5.3 / 5.1 | 0.85 |
| Stronger by 8 OVR | 53.8% | 27.0% | 19.2% | 1.63 | 0.99 | 5.4 | 1.74 | 1.08 | 52.7% | 36.8 | 74.6% | 3.6 | 6.3 / 5.2 | 0.86 |
| Stronger by 12 OVR | 62.4% | 23.6% | 14.0% | 1.73 | 0.83 | 5.6 | 1.88 | 0.88 | 52.6% | 36.4 | 76.6% | 3.4 | 6.2 / 4.7 | 0.85 |
| Stronger by 18 OVR | 78.8% | 15.5% | 5.7% | 2.25 | 0.72 | 6.5 | 2.40 | 0.74 | 54.4% | 37.7 | 77.6% | 3.9 | 6.9 / 4.5 | 0.86 |

## Formations

| Scenario (focus team) | Win | Draw | Loss | GF | GA | Shots | xG | xGA | Poss | Passes | Pass % | Tackles won | Turnovers won / lost | End stamina |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 3-2-1 Fortress vs 2-2-2 | 36.6% | 33.2% | 30.2% | 1.17 | 1.08 | 5.5 | 1.18 | 1.26 | 54.0% | 37.6 | 78.8% | 1.4 | 4.6 / 4.0 | 0.84 |
| 2-2-2 Balanced vs 2-2-2 (control) | 34.5% | 28.6% | 36.9% | 1.29 | 1.33 | 4.7 | 1.49 | 1.42 | 50.3% | 36.4 | 74.9% | 1.7 | 4.8 / 4.8 | 0.84 |

## Tactics (chip re-used whenever ready)

| Scenario (focus team) | Win | Draw | Loss | GF | GA | Shots | xG | xGA | Poss | Passes | Pass % | Tackles won | Turnovers won / lost | End stamina |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| No chips (control) | 36.1% | 26.6% | 37.3% | 1.30 | 1.31 | 4.4 | 1.38 | 1.41 | 49.9% | 36.0 | 73.9% | 2.8 | 5.6 / 5.6 | 0.84 |
| PRESS whenever ready | 49.9% | 26.6% | 23.5% | 1.34 | 0.90 | 4.4 | 1.38 | 0.98 | 47.7% | 33.1 | 73.6% | 4.3 | 6.3 / 5.6 | 0.75 |
| QUICK PASS whenever ready | 30.5% | 31.4% | 38.1% | 1.16 | 1.33 | 3.9 | 1.26 | 1.45 | 50.8% | 45.2 | 74.3% | 2.5 | 5.4 / 5.8 | 0.86 |

## Incidents per match (mirror scenario, both teams)

| Incident | Per match |
|---|---|
| Crosses: complete | 1.42 |
| Crosses: intercepted | 0.58 |
| Crosses: loose | 0.11 |
| Fouls: booking | 0.41 |
| Fouls: free kick | 1.23 |
| Fouls: penalty awarded | 0.12 |
| Goals: freeKick | 0.01 |
| Goals: header | 0.30 |
| Goals: long | 0.09 |
| Goals: normal | 1.84 |
| Goals: penalty | 0.09 |
| Goals: volley | 0.28 |
| Restarts: corner | 1.14 |
| Saves: catch | 0.75 |
| Saves: dive | 0.37 |
| Saves: double save | 0.07 |
| Saves: fingertip | 0.15 |
| Saves: parry | 0.76 |
| Shots: freeKick | 0.10 |
| Shots: header | 1.37 |
| Shots: long | 0.72 |
| Shots: normal | 5.91 |
| Shots: penalty | 0.12 |
| Shots: volley | 0.67 |
| Skills: dragBack | 0.31 |
| Skills: flick | 0.03 |
| Skills: nutmeg | 0.35 |
| Skills: roulette | 0.10 |
| Skills: stepover | 0.52 |
| Tackles: slide lost | 1.97 |
| Tackles: slide won | 1.82 |
| Tackles: standing lost | 5.79 |
| Tackles: standing won | 3.76 |

## How to read this
- *Mirror* checks engine fairness: the same team against itself should split wins and losses evenly.
- *Power gaps* should show a clear, rising edge for the stronger team without guaranteed wins.
- *Tactics*: PRESS should raise tackles/turnovers won and lower end stamina; QUICK PASS should raise pass volume.
