/**
 * Headless balance simulation for Prism Deck.
 * Verifies:
 *  1. Ante 1 is welcoming even for a bare starter player (no shop purchases).
 *  2. Bare starter builds hit a meaningful wall well before Ante 8 (proving progression matters).
 *  3. A smart greedy bot that buys Charms, orders them left-to-right (+Chips/+Mult -> ×Mult -> Understudy),
 *     chases Synergies, buys Star Charts & Vouchers, and adapts to Boss Blinds cleanly beats Ante 8
 *     at a healthy roguelike win rate and climbs sensibly into Endless Antes 9-12!
 */
import {
  CHARM_BY_ID,
  SYNERGY_PAIRS,
  buyShopCharm,
  buySpell,
  buyStarChart,
  buyVoucher,
  castSpell,
  continueEndless,
  createRun,
  discardSelected,
  findAllSetsOnBoard,
  getCharmSellValue,
  getSmallBlindTarget,
  leaveShop,
  playSelectedSet,
  reorderCharm,
  rerollShop,
  scoreSet,
  selectBlind,
  sellCharm,
  skipBlind,
  toggleCard,
  type PrismRun,
} from '@/prism';

interface SimResult {
  seed: string;
  clearedAnte8: boolean;
  highestAnteCleared: number;
  bestSingleSet: number;
  finalCharms: string[];
  synergiesFormed: number;
}

const CHARM_PRIORITY: Record<string, number> = {
  // Top-tier xMult & utility engines
  'understudy': 98,
  'amplifier-coil': 95,
  'prism-sovereign': 94,
  'rainbow-charm': 92,
  'tightrope': 90,
  'collectors-album': 88,
  'glass-sword': 86,
  'amethyst-crown': 85,
  'geometric-savant': 84,
  'last-stand': 82,
  'alchemists-flask': 80,
  'glass-cannon': 78,
  // Strong scaling +Mult / +Chips / Econ
  'snowball': 80,
  'star-astronomer': 78,
  'edition-forge': 76,
  'wild-card': 75,
  'discard-furnace': 72,
  'odd-one-out': 70,
  'rally-horn': 68,
  'greedy-chest': 68,
  'fortunes-favor': 66,
  'pendulum': 65,
  'mirror-shard': 62,
  'field-stone': 62,
  'magnet': 60,
  'golden-abacus': 58,
  'ruby-prism': 56,
  'emerald-lens': 55,
  'trinity-bell': 55,
  'bounty-poster': 54,
  'minimalist-monk': 52,
  'sculptors-chisel': 52,
};

/** Reorder Charms for optimal Balatro left-to-right scoring (+Chips/+Mult -> ×Mult -> Understudy/Amplifier). */
const optimizeCharmOrder = (run: PrismRun): PrismRun => {
  if (run.charms.length <= 1) return run;

  const isEclipse = run.activeBossId === 'the_eclipse';
  const orderWeight = (charmId: string): number => {
    const role = CHARM_BY_ID[charmId]?.role;
    if (charmId === 'amplifier-coil') return 35; // place just left of strongest xMult
    if (charmId === 'understudy') return 55; // place just right of strongest xMult
    if (role === 'econ') return 5;
    if (role === 'chips') return 10;
    if (role === 'mult') return 20;
    if (role === 'utility') return 15;
    if (role === 'xmult') return 40 + (CHARM_PRIORITY[charmId] ?? 50) / 1000;
    return 30;
  };

  // Build desired order of instanceIds
  const sorted = [...run.charms].sort((a, b) => orderWeight(a.charmId) - orderWeight(b.charmId));

  // If Understudy is present, place it immediately to the right of the best non-utility xMult/mult charm
  const underIdx = sorted.findIndex(c => c.charmId === 'understudy');
  if (underIdx >= 0) {
    const [under] = sorted.splice(underIdx, 1);
    let bestAnchor = sorted.length - 1;
    let bestScore = -1;
    sorted.forEach((c, idx) => {
      if (c.charmId !== 'amplifier-coil' && c.charmId !== 'understudy') {
        const s = CHARM_PRIORITY[c.charmId] ?? 50;
        if (s > bestScore) {
          bestScore = s;
          bestAnchor = idx;
        }
      }
    });
    sorted.splice(bestAnchor + 1, 0, under);
  }

  // If Amplifier Coil is present, place it immediately to the left of the highest-priority non-utility charm
  const ampIdx = sorted.findIndex(c => c.charmId === 'amplifier-coil');
  if (ampIdx >= 0) {
    const [amp] = sorted.splice(ampIdx, 1);
    let bestAnchor = 0;
    let bestScore = -1;
    sorted.forEach((c, idx) => {
      if (c.charmId !== 'amplifier-coil' && c.charmId !== 'understudy') {
        const s = CHARM_PRIORITY[c.charmId] ?? 50;
        if (s > bestScore) {
          bestScore = s;
          bestAnchor = idx;
        }
      }
    });
    sorted.splice(bestAnchor, 0, amp);
  }

  // Against The Eclipse, sacrifice the lowest-priority charm to slot 0!
  if (isEclipse && sorted.length > 1) {
    let worstIdx = 0;
    let worstPrio = Infinity;
    sorted.forEach((c, idx) => {
      const p = CHARM_PRIORITY[c.charmId] ?? 50;
      if (p < worstPrio) {
        worstPrio = p;
        worstIdx = idx;
      }
    });
    const [sac] = sorted.splice(worstIdx, 1);
    sorted.unshift(sac);
  }

  let cur = run;
  for (let targetIdx = 0; targetIdx < sorted.length; targetIdx++) {
    const wantId = sorted[targetIdx].instanceId;
    const fromIdx = cur.charms.findIndex(c => c.instanceId === wantId);
    if (fromIdx !== targetIdx && fromIdx >= 0) {
      cur = reorderCharm(cur, fromIdx, targetIdx);
    }
  }
  return cur;
};

/** Evaluate a Charm's synergy-aware value for our current roster. */
const scoreCharmOffer = (run: PrismRun, charmId: string): number => {
  let score = CHARM_PRIORITY[charmId] ?? 50;
  const ownedIds = new Set(run.charms.map(c => c.charmId));
  for (const pair of SYNERGY_PAIRS) {
    if (
      (pair.charmA === charmId && ownedIds.has(pair.charmB)) ||
      (pair.charmB === charmId && ownedIds.has(pair.charmA))
    ) {
      score += 28; // strongly favor completing Synergy Pairs!
    }
  }
  // Ensure early-game flat Chips / Mult before stacking pure xMult
  const role = CHARM_BY_ID[charmId]?.role;
  const hasFlatMult = run.charms.some(c => CHARM_BY_ID[c.charmId]?.role === 'mult');
  const hasChips = run.charms.some(c => CHARM_BY_ID[c.charmId]?.role === 'chips');
  if (run.ante <= 2 && role === 'mult' && !hasFlatMult) score += 20;
  if (run.ante <= 3 && role === 'chips' && !hasChips) score += 12;
  if (run.ante >= 3 && role === 'xmult') score += 16;
  return score;
};

const playBlindGreedily = (run: PrismRun, smart: boolean): PrismRun => {
  let cur = smart ? optimizeCharmOrder(run) : run;

  while (cur.phase === 'playing') {
    // Use owned Spells proactively on board cards (especially Stamps / Prune)
    if (smart && cur.spells.length > 0 && cur.board.length > 0) {
      const sp = cur.spells[0];
      if (sp.spellId === 'glass-stamp' || sp.spellId === 'wild-stamp' || sp.spellId === 'gild') {
        const plainIdx = cur.board.findIndex(c => c.edition === 'none');
        if (plainIdx >= 0) {
          cur = castSpell(cur, 0, cur.board[plainIdx].id);
          continue;
        }
      } else if (sp.spellId === 'clone') {
        const bestEdIdx = cur.board.findIndex(c => c.edition !== 'none');
        const target = cur.board[bestEdIdx >= 0 ? bestEdIdx : 0];
        cur = castSpell(cur, 0, target.id);
        continue;
      } else if (sp.spellId === 'prune' && cur.deck.length > 18) {
        const plainIdx = cur.board.findIndex(c => c.edition === 'none' && c.number === 1);
        if (plainIdx >= 0) {
          cur = castSpell(cur, 0, cur.board[plainIdx].id);
          continue;
        }
      } else {
        cur = castSpell(cur, 0, cur.board[0].id);
        continue;
      }
    }

    const allSets = findAllSetsOnBoard(cur.board, cur.boardCols);
    if (allSets.length === 0) break;

    let bestSet = allSets[0];
    let bestScore = -1;
    for (const candidate of allSets) {
      const scored = scoreSet(cur, candidate.indices, { preview: true });
      const val = scored ? scored.finalScore + scored.goldDelta * 15 : 0;
      if (val > bestScore) {
        bestScore = val;
        bestSet = candidate;
      }
    }

    // Smart discard if Discard Furnace owned (and no Snowball) or current best Set is weak on early hands
    const hasFurnace = cur.charms.some(c => c.charmId === 'discard-furnace');
    const hasSnowball = cur.charms.some(c => c.charmId === 'snowball');
    const remainingTarget = cur.blindTarget - cur.blindScore;
    if (
      smart &&
      cur.discardsLeft > 0 &&
      !hasSnowball &&
      bestScore < remainingTarget &&
      (hasFurnace || bestScore < remainingTarget / Math.max(1, cur.handsLeft) * 0.75)
    ) {
      // Discard up to 3 non-edition cards not in bestSet
      const bestIdxSet = new Set(bestSet.indices);
      const toDiscard: number[] = [];
      for (let i = 0; i < cur.board.length && toDiscard.length < 3; i++) {
        if (!bestIdxSet.has(i) && cur.board[i].edition === 'none') toDiscard.push(i);
      }
      if (toDiscard.length > 0) {
        for (const idx of toDiscard) cur = toggleCard(cur, idx);
        cur = discardSelected(cur);
        continue;
      }
    }

    // Select & play the highest-scoring Set
    for (const idx of bestSet.indices) {
      cur = toggleCard(cur, idx);
    }
    cur = playSelectedSet(cur);
  }

  return cur;
};

const shopSmartly = (run: PrismRun): PrismRun => {
  let cur = run;
  const interestFloor = cur.ante <= 2 ? 0 : cur.ante <= 5 ? 10 : 0;

  // 1. Buy high-value Ante Vouchers when affordable
  if (cur.shop?.voucher && !cur.shop.voucher.sold && cur.gold >= cur.shop.voucher.price + 4) {
    const vid = cur.shop.voucher.voucherId;
    if (vid === 'extra_charm_slot' || vid === 'extra_hand' || vid === 'telescope' || vid === 'clearance_sale') {
      cur = buyVoucher(cur);
    }
  }

  // 2. Evaluate Charm offers (fill empty slots or upgrade weak Charm)
  for (let pass = 0; pass < 2; pass++) {
    if (!cur.shop) break;
    const rankedOffers = cur.shop.charms
      .map((o, idx) => ({ o, idx, val: scoreCharmOffer(cur, o.charmId) }))
      .filter(x => !x.o.sold)
      .sort((a, b) => b.val - a.val);

    for (const offer of rankedOffers) {
      if (cur.charms.length < cur.maxCharms) {
        if (cur.gold >= offer.o.price && (cur.gold - offer.o.price >= interestFloor || offer.val >= 72 || cur.charms.length < 3)) {
          cur = buyShopCharm(cur, offer.idx);
        }
      } else {
        // Check if this Charm significantly upgrades our weakest owned Charm
        let worstIdx = -1;
        let worstVal = Infinity;
        cur.charms.forEach((c, idx) => {
          const v = scoreCharmOffer(cur, c.charmId) - (c.charmId === 'snowball' ? c.state.counter : 0);
          if (v < worstVal) {
            worstVal = v;
            worstIdx = idx;
          }
        });
        if (worstIdx >= 0 && offer.val >= worstVal + 14) {
          const sellVal = getCharmSellValue(cur.charms[worstIdx].charmId);
          if (cur.gold + sellVal >= offer.o.price) {
            cur = sellCharm(cur, worstIdx);
            cur = buyShopCharm(cur, offer.idx);
          }
        }
      }
    }

    // 3. Buy Star Charts (prefer high-value Pattern Hands)
    const chartCount = cur.shop?.starCharts.length ?? 0;
    for (let i = 0; i < chartCount; i++) {
      const sc = cur.shop?.starCharts[i];
      if (sc && !sc.sold && cur.gold >= sc.price + interestFloor) {
        if (
          sc.handId === 'prismatic_crown' ||
          sc.handId === 'adjacency_chain' ||
          sc.handId === 'true_rainbow' ||
          cur.charms.some(c => c.charmId === 'star-astronomer')
        ) {
          cur = buyStarChart(cur, i);
        }
      }
    }

    // 4. Buy Edition/Deck-sculpting Spells
    const spellCount = cur.shop?.spells.length ?? 0;
    for (let i = 0; i < spellCount && cur.spells.length < cur.maxSpells; i++) {
      const sp = cur.shop?.spells[i];
      if (
        sp &&
        !sp.sold &&
        cur.spells.length < cur.maxSpells &&
        cur.gold >= sp.price + interestFloor &&
        (sp.spellId === 'glass-stamp' || sp.spellId === 'wild-stamp' || sp.spellId === 'gild' || sp.spellId === 'clone')
      ) {
        cur = buySpell(cur, i);
      }
    }

    // 5. Reroll once if rich and hunting upgrades
    if (pass === 0 && cur.shop && cur.gold >= cur.shop.rerollCost + 14 && cur.ante >= 3) {
      cur = rerollShop(cur);
    } else {
      break;
    }
  }

  return optimizeCharmOrder(cur);
};

const simulateRun = (
  seed: string,
  options: { smart: boolean; maxAnte: number; enterEndless: boolean }
): SimResult => {
  let run = createRun({ seed });
  let clearedAnte8 = false;
  let highestAnteCleared = 0;

  let guard = 0;
  while (run.phase !== 'defeat' && guard < 300) {
    guard += 1;

    if (run.phase === 'victory') {
      clearedAnte8 = true;
      highestAnteCleared = Math.max(highestAnteCleared, 8);
      if (!options.enterEndless || options.maxAnte <= 8) break;
      run = continueEndless(run);
      continue;
    }

    if (run.phase === 'blind_select') {
      if (run.ante > options.maxAnte) break;
      // Smart bot occasionally skips Small Blind for high-value Rare Charm or Polychrome tag in Ante 2-4
      const offer = run.anteBlinds[run.blindIndex];
      if (
        options.smart &&
        offer.kind === 'small' &&
        run.ante >= 2 &&
        run.ante <= 4 &&
        (offer.skipTagId === 'charm_pack' || offer.skipTagId === 'polychrome_spark')
      ) {
        run = skipBlind(run);
        continue;
      }
      run = selectBlind(run);
      continue;
    }

    if (run.phase === 'playing') {
      const anteBefore = run.ante;
      const blindBefore = run.blindIndex;
      run = playBlindGreedily(run, options.smart);
      if ((run.phase === 'shop' || run.phase === 'victory') && blindBefore === 2) {
        highestAnteCleared = Math.max(highestAnteCleared, anteBefore);
      }
      continue;
    }

    if (run.phase === 'shop') {
      if (options.smart) run = shopSmartly(run);
      run = leaveShop(run);
      continue;
    }
  }

  const activeSynergies = SYNERGY_PAIRS.filter(
    p => run.charms.some(c => c.charmId === p.charmA) && run.charms.some(c => c.charmId === p.charmB)
  ).length;

  return {
    seed,
    clearedAnte8,
    highestAnteCleared,
    bestSingleSet: run.stats.bestSingleSet,
    finalCharms: run.charms.map(c => c.charmId),
    synergiesFormed: activeSynergies,
  };
};

describe('Prism Deck — Headless Balance Simulation (Antes 1-8 & Endless 9-12)', () => {
  const SEEDS = Array.from({ length: 24 }, (_, i) => `BAL-SEED-${String(i + 1).padStart(2, '0')}`);

  it('keeps Ante 1 welcoming yet ensures bare starter builds cannot cruise to Ante 8', () => {
    const results = SEEDS.map(seed => simulateRun(seed, { smart: false, maxAnte: 8, enterEndless: false }));
    const ante1Clears = results.filter(r => r.highestAnteCleared >= 1).length;
    const ante8Clears = results.filter(r => r.clearedAnte8).length;
    const avgHighest = results.reduce((s, r) => s + r.highestAnteCleared, 0) / results.length;

    // Ante 1 should be welcoming (>= 75% clear rate even without buying anything)
    expect(ante1Clears / results.length).toBeGreaterThanOrEqual(0.75);
    // Bare starter deck MUST hit a wall before Ante 8 (0% clear rate with zero upgrades!)
    expect(ante8Clears).toBe(0);
    // Bare starter typically stalls around Ante 1-3
    expect(avgHighest).toBeGreaterThanOrEqual(0.8);
    expect(avgHighest).toBeLessThanOrEqual(3.5);
  });

  it('allows a smart greedy synergy bot to cleanly beat Ante 1-8 and climb into Endless Ante 9-12', () => {
    const results = SEEDS.map(seed => simulateRun(seed, { smart: true, maxAnte: 12, enterEndless: true }));
    const winCount = results.filter(r => r.clearedAnte8).length;
    const winRate = winCount / results.length;
    const endlessReach = results.filter(r => r.highestAnteCleared >= 9).length;
    const maxEndlessAnte = Math.max(...results.map(r => r.highestAnteCleared));
    const maxSingleSet = Math.max(...results.map(r => r.bestSingleSet));

    // Smart bot should clear Ante 8 at a healthy, rewarding roguelike win rate (>= 50%)
    expect(winRate).toBeGreaterThanOrEqual(0.5);
    // Winning builds should push into Endless Ante 9+
    expect(endlessReach).toBeGreaterThanOrEqual(3);
    expect(maxEndlessAnte).toBeGreaterThanOrEqual(9);
    // Peak single Sets should hit genuinely juicy Balatro numbers (>= 50,000)
    expect(maxSingleSet).toBeGreaterThanOrEqual(50_000);
    // Endless curve (Ante 9-12) escalates strictly monotonically
    expect(getSmallBlindTarget(9)).toBeGreaterThan(getSmallBlindTarget(8));
    expect(getSmallBlindTarget(10)).toBeGreaterThan(getSmallBlindTarget(9));
    expect(getSmallBlindTarget(11)).toBeGreaterThan(getSmallBlindTarget(10));
    expect(getSmallBlindTarget(12)).toBeGreaterThan(getSmallBlindTarget(11));
  });
});
