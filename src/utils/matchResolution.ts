/**
 * Works out everything one successful selection does to the board: weapon
 * effects, linked cards, echo Sets, and the reward each affected card pays.
 */
import type { AttributeName, BoardConnection, Card, CardReward, PlayerStats, Weapon } from '@/types';
import { MATCH_REWARDS } from './gameConfig';
import { getLinkedDestructionPositions } from './connectionUtils';
import { isValidCombination } from './gameUtils';
import { processWeaponEffects, type WeaponEffectResult } from './weaponEffects';

type CollateralEffect = 'explosion' | 'laser' | 'ricochet' | 'connected';

/** What a card destroyed by a weapon effect pays, by effect. */
const COLLATERAL_REWARDS: Record<CollateralEffect, { points: number; money: number }> = {
  explosion: { points: 1, money: 1 },
  laser: { points: 2, money: 1 },
  ricochet: { points: 1, money: 1 },
  connected: { points: 1, money: 1 },
};

/** The stat that adds damage per card to an effect (Blast Powder, Prismatic Ray, Chaos Shard levels and tuning). */
const COLLATERAL_BONUS: Partial<Record<CollateralEffect, 'explosionDamage' | 'laserDamage' | 'ricochetDamage'>> = {
  explosion: 'explosionDamage',
  laser: 'laserDamage',
  ricochet: 'ricochetDamage',
};

const collateralReward = (card: Card, effectType: CollateralEffect, stats?: PlayerStats): CardReward => {
  const bonus = COLLATERAL_BONUS[effectType];
  const base = COLLATERAL_REWARDS[effectType];
  return {
    cardId: card.id,
    ...base,
    points: base.points + (bonus && stats ? stats[bonus] ?? 0 : 0),
    effectType,
  };
};

/** The reward for a card the player picked as part of a Set. */
export const selectedCardReward = (card: Card): CardReward => {
  const reward: CardReward = {
    cardId: card.id,
    points: MATCH_REWARDS.basePoints + (card.bonusPoints ?? 0) + (card.charge ?? 0),
    money: MATCH_REWARDS.baseMoney + (card.bonusMoney ?? 0),
    experience: MATCH_REWARDS.baseExperience,
  };
  if (card.healing) reward.healing = 1;
  if (card.lootBox) reward.lootBox = true;
  if (Math.random() < MATCH_REWARDS.hintDropChance) reward.hint = 1;
  return reward;
};

/** The first Set among `cards`, or null. */
export const findSet = (cards: Card[], activeAttributes: AttributeName[]): Card[] | null => {
  for (let i = 0; i < cards.length - 2; i++) {
    for (let j = i + 1; j < cards.length - 1; j++) {
      for (let k = j + 1; k < cards.length; k++) {
        const candidate = [cards[i], cards[j], cards[k]];
        if (isValidCombination(candidate, activeAttributes).isValid) return candidate;
      }
    }
  }
  return null;
};

export interface MatchResolution {
  /** The selected cards first, then every other card the match destroys or damages */
  cards: Card[];
  /** One reward per entry of `cards`, in the same order */
  rewards: CardReward[];
  weaponEffects: WeaponEffectResult;
  /** Board cards pulled in through connector links */
  connectedCards: Card[];
}

export const resolveMatch = (input: {
  board: Card[];
  selected: Card[];
  playerStats: PlayerStats;
  weapons?: Weapon[];
  activeAttributes: AttributeName[];
  connections: BoardConnection[];
  timeGainContext?: { triggersThisRound: number; effectiveCap: number };
  /** The selection was one attribute off and a grace turned it into a match */
  graceUsed: boolean;
}): MatchResolution => {
  const { board, selected, playerStats, weapons, activeAttributes, connections } = input;

  const selectedRewards = selected.map(selectedCardReward);
  const weaponEffects = processWeaponEffects(
    board, selected, playerStats, weapons, activeAttributes, false, input.timeGainContext, input.graceUsed
  );

  const cards = [...selected];
  const rewards = [...selectedRewards];
  const add = (card: Card, effectType: CollateralEffect) => {
    cards.push(card);
    rewards.push(collateralReward(card, effectType, playerStats));
  };
  weaponEffects.explosiveCards.forEach(c => add(c, 'explosion'));
  weaponEffects.laserCards.forEach(c => add(c, 'laser'));
  weaponEffects.ricochetCards.forEach(c => add(c, 'ricochet'));

  const connectedCards: Card[] = [];
  if (connections.length > 0) {
    const destroyed = new Set<number>();
    for (const card of cards) {
      const idx = board.findIndex(c => c.id === card.id);
      if (idx !== -1) destroyed.add(idx);
    }
    const visited = new Set<number>();
    const linked: number[] = [];
    for (const pos of destroyed) {
      if (!visited.has(pos)) linked.push(...getLinkedDestructionPositions(connections, pos, visited));
    }
    for (const pos of linked) {
      if (pos < 0 || pos >= board.length || destroyed.has(pos)) continue;
      const card = board[pos];
      if (card && !connectedCards.some(c => c.id === card.id)) {
        connectedCards.push(card);
        add(card, 'connected');
      }
    }
  }

  // Echo: each auto-matched Set scores like a picked Set and rolls its own weapon effects (but never another echo)
  const alreadyHit = [...cards];
  for (const echoSet of weaponEffects.autoMatchedSets) {
    for (const c of echoSet) {
      cards.push(c);
      rewards.push({
        cardId: c.id,
        points: MATCH_REWARDS.basePoints + (c.bonusPoints ?? 0) + (c.charge ?? 0),
        money: MATCH_REWARDS.baseMoney + (c.bonusMoney ?? 0),
        experience: MATCH_REWARDS.baseExperience,
      });
    }
    const echoEffects = processWeaponEffects(board, echoSet, playerStats, weapons, activeAttributes, true);
    const addEcho = (c: Card, effectType: CollateralEffect) => {
      if (alreadyHit.some(hit => hit.id === c.id)) return;
      add(c, effectType);
      alreadyHit.push(c);
    };
    echoEffects.explosiveCards.forEach(c => addEcho(c, 'explosion'));
    echoEffects.laserCards.forEach(c => addEcho(c, 'laser'));
    echoEffects.ricochetCards.forEach(c => addEcho(c, 'ricochet'));

    weaponEffects.bonusHealing += echoEffects.bonusHealing;
    weaponEffects.bonusHints += echoEffects.bonusHints;
    weaponEffects.bonusTime += echoEffects.bonusTime;
    weaponEffects.bonusGraces += echoEffects.bonusGraces;
    weaponEffects.bonusPoints += echoEffects.bonusPoints;
    weaponEffects.bonusMoney += echoEffects.bonusMoney;
    weaponEffects.boardGrowth += echoEffects.boardGrowth;
    weaponEffects.notifications.push(...echoEffects.notifications);

    alreadyHit.push(...echoSet);
  }

  // Game and the adventure engine read this marker to spend the grace
  if (input.graceUsed && selectedRewards.length > 0) rewards[0] = { ...rewards[0], effectType: 'grace' };

  return { cards, rewards, weaponEffects, connectedCards };
};
