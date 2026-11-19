/**
 * Deterministic Slay-the-Spire branching Act map generator.
 *
 * Each Act has 7 rows (0 = Entrance Skirmishes → 5 = Pre-Boss Campfire/Shop →
 * 6 = Act Boss) across 3 clean lanes so every path reads crisply on mobile
 * screens without horizontal overflow or tangled edges.
 */
import { createRng } from '@/adventure/engine/rng';
import { foeDisplay } from '@/adventure/data/foes';
import type { SpireActMap, SpireNode, SpireNodeKind } from '../types';
import { ascensionModifiers } from '../data/ascensions';
import { actThemeFor, generateSpireEncounter } from '../data/encounters';
import { SPIRE_EVENTS } from '../data/events';

const ROWS = 7;
const COLS = 3;

const nodeId = (act: number, row: number, col: number) => `a${act}-r${row}-c${col}`;

export const generateActMap = (
  act: number,
  seed: number,
  ascension: number,
  seenEvents: readonly string[] = []
): SpireActMap => {
  const rng = createRng((seed ^ (act * 0x9e3779b1) ^ (ascension * 0x85ebca6b)) >>> 0);
  const theme = actThemeFor(act);
  const asc = ascensionModifiers(ascension);

  const unseenEvents = rng.shuffle(SPIRE_EVENTS.map(e => e.id).filter(id => !seenEvents.includes(id)));
  const fallbackEvents = rng.shuffle(SPIRE_EVENTS.map(e => e.id));
  let eventCursor = 0;
  const pickEventId = (): string => {
    if (eventCursor < unseenEvents.length) return unseenEvents[eventCursor++];
    return fallbackEvents[eventCursor++ % fallbackEvents.length];
  };

  // Row layouts guarantee varied tactical routing (safe vs greedy Elite vs Shop/Campfire)
  const rowTemplates: SpireNodeKind[][] = [
    ['skirmish', 'skirmish', 'skirmish'],
    rng.shuffle<SpireNodeKind>(['skirmish', 'event', 'shop']),
    rng.shuffle<SpireNodeKind>(asc.extraElites > 0 ? ['elite', 'elite', 'event'] : ['elite', 'skirmish', 'event']),
    rng.shuffle<SpireNodeKind>(['treasure', 'shop', 'campfire']),
    rng.shuffle<SpireNodeKind>(['elite', 'skirmish', 'event']),
    rng.shuffle<SpireNodeKind>(['campfire', 'campfire', 'shop']),
  ];

  const nodes: SpireNode[] = [];
  const byRow: SpireNode[][] = [];

  for (let r = 0; r < ROWS - 1; r++) {
    const rowNodes: SpireNode[] = [];
    for (let c = 0; c < COLS; c++) {
      const kind = rowTemplates[r][c];
      const id = nodeId(act, r, c);
      const node: SpireNode = {
        id,
        row: r,
        col: c,
        kind,
        next: [],
        visited: false,
      };
      if (kind === 'skirmish' || kind === 'elite') {
        node.encounter = generateSpireEncounter({ act, row: r, kind, ascension, rng, id: `enc-${id}` });
      } else if (kind === 'event') {
        node.eventId = pickEventId();
      }
      rowNodes.push(node);
      nodes.push(node);
    }
    byRow.push(rowNodes);
  }

  // Row 6: Act Boss centered on lane 1
  const bossId = nodeId(act, ROWS - 1, 1);
  const bossEncounter = generateSpireEncounter({
    act,
    row: ROWS - 1,
    kind: 'boss',
    ascension,
    rng,
    id: `enc-${bossId}`,
  });
  const bossNode: SpireNode = {
    id: bossId,
    row: ROWS - 1,
    col: 1,
    kind: 'boss',
    next: [],
    visited: false,
    encounter: bossEncounter,
  };
  nodes.push(bossNode);
  byRow.push([bossNode]);

  // Connect consecutive rows cleanly without edge crossings (lane c → c or adjacent lane)
  for (let r = 0; r < ROWS - 2; r++) {
    const cur = byRow[r];
    const nxt = byRow[r + 1];
    const incoming = new Array<number>(COLS).fill(0);

    for (let c = 0; c < COLS; c++) {
      // Every node connects straight forward, plus 0–1 adjacent diagonal branch
      const targets = new Set<number>([c]);
      const diagOptions = [c - 1, c + 1].filter(x => x >= 0 && x < COLS);
      if (diagOptions.length > 0 && rng.next() < 0.72) {
        targets.add(rng.pick(diagOptions));
      }
      const sorted = [...targets].sort((a, b) => a - b);
      cur[c].next = sorted.map(tc => nxt[tc].id);
      for (const tc of sorted) incoming[tc] += 1;
    }

    // Safety: ensure every node on row r+1 is reachable (already true via straight edges, keep guard)
    for (let c = 0; c < COLS; c++) {
      if (incoming[c] === 0) {
        cur[c].next.push(nxt[c].id);
      }
    }
  }

  // Every Row 5 node converges on the Act Boss
  for (const n of byRow[ROWS - 2]) {
    n.next = [bossId];
  }

  const bossDisplay = foeDisplay(bossEncounter.foes[0]);
  return {
    act,
    title: theme.title,
    subtitle: theme.subtitle,
    biome: theme.biome,
    rows: ROWS,
    cols: COLS,
    nodes,
    bossName: bossDisplay.name,
    bossIcon: bossDisplay.icon,
  };
};

/** Node ids currently selectable on the map (Row 0 before first step, else `current.next`). */
export const reachableNodeIds = (map: SpireActMap, currentNodeId: string | null): string[] => {
  if (!currentNodeId) {
    return map.nodes.filter(n => n.row === 0).map(n => n.id);
  }
  const cur = map.nodes.find(n => n.id === currentNodeId);
  return cur ? [...cur.next] : [];
};
