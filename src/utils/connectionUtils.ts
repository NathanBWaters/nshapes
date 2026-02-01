/**
 * Connection Utilities
 *
 * Helper functions for the Connector weapon system.
 * Connections persist on board POSITIONS (not cards).
 * When a card at a connected position is destroyed, the card at the linked position is also destroyed.
 */

import type { BoardConnection, Card, PlayerStats } from '../types';

/**
 * Generate a unique connection ID
 */
export const generateConnectionId = (): string => {
  return `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Create a new connection between two board positions
 */
export const createConnection = (positionA: number, positionB: number): BoardConnection => {
  return {
    id: generateConnectionId(),
    positionA: Math.min(positionA, positionB), // Always store lower position first for consistency
    positionB: Math.max(positionA, positionB),
    createdAt: Date.now(),
  };
};

/**
 * Check if two positions are already connected
 */
export const arePositionsConnected = (
  connections: BoardConnection[],
  posA: number,
  posB: number
): boolean => {
  const minPos = Math.min(posA, posB);
  const maxPos = Math.max(posA, posB);
  return connections.some(
    conn => conn.positionA === minPos && conn.positionB === maxPos
  );
};

/**
 * Get all positions connected to a given position
 */
export const getConnectedPositions = (
  connections: BoardConnection[],
  position: number
): number[] => {
  const connected: number[] = [];
  for (const conn of connections) {
    if (conn.positionA === position) {
      connected.push(conn.positionB);
    } else if (conn.positionB === position) {
      connected.push(conn.positionA);
    }
  }
  return connected;
};

/**
 * Get all positions that should be destroyed when a position is destroyed.
 * This includes chain reactions (if A→B and B→C, destroying A also destroys B and C).
 * Returns positions in order of destruction (for animation sequencing).
 */
export const getLinkedDestructionPositions = (
  connections: BoardConnection[],
  destroyedPosition: number,
  alreadyProcessed: Set<number> = new Set()
): number[] => {
  if (alreadyProcessed.has(destroyedPosition)) {
    return [];
  }

  alreadyProcessed.add(destroyedPosition);
  const directlyConnected = getConnectedPositions(connections, destroyedPosition);
  const allDestroyed: number[] = [];

  for (const pos of directlyConnected) {
    if (!alreadyProcessed.has(pos)) {
      allDestroyed.push(pos);
      // Recursively get positions connected to this one (chain reaction)
      const chainedDestruction = getLinkedDestructionPositions(connections, pos, alreadyProcessed);
      allDestroyed.push(...chainedDestruction);
    }
  }

  return allDestroyed;
};

/**
 * Roll to see if a connection should be created based on player stats
 */
export const shouldCreateConnection = (stats: PlayerStats): boolean => {
  const chance = stats.connectionChance || 0;
  if (chance <= 0) return false;
  return Math.random() * 100 < chance;
};

/**
 * Roll to see if a bonus connection should be created (Neural Network weapon)
 */
export const shouldCreateBonusConnection = (stats: PlayerStats): boolean => {
  const chance = stats.bonusConnectionChance || 0;
  if (chance <= 0) return false;
  return Math.random() * 100 < chance;
};

/**
 * Create random starting connections for Web Weaver weapons
 */
export const createRandomConnections = (
  boardSize: number,
  count: number,
  existingConnections: BoardConnection[] = []
): BoardConnection[] => {
  const newConnections: BoardConnection[] = [];
  const maxAttempts = count * 10; // Prevent infinite loops
  let attempts = 0;

  while (newConnections.length < count && attempts < maxAttempts) {
    attempts++;

    // Pick two random different positions
    const posA = Math.floor(Math.random() * boardSize);
    let posB = Math.floor(Math.random() * boardSize);

    // Make sure we pick different positions
    if (posA === posB) continue;

    // Check if this connection already exists
    const allConnections = [...existingConnections, ...newConnections];
    if (arePositionsConnected(allConnections, posA, posB)) continue;

    newConnections.push(createConnection(posA, posB));
  }

  return newConnections;
};

/**
 * Select two positions from matched card positions to connect
 */
export const selectPositionsToConnect = (
  matchedPositions: number[],
  existingConnections: BoardConnection[]
): [number, number] | null => {
  if (matchedPositions.length < 2) return null;

  // Try to find an unconnected pair
  for (let i = 0; i < matchedPositions.length; i++) {
    for (let j = i + 1; j < matchedPositions.length; j++) {
      const posA = matchedPositions[i];
      const posB = matchedPositions[j];
      if (!arePositionsConnected(existingConnections, posA, posB)) {
        return [posA, posB];
      }
    }
  }

  // All positions already connected, pick random pair anyway
  // (but don't create duplicate connection)
  return null;
};

/**
 * Roll for Revenge Linker connections (on damage, 3 separate 20% rolls)
 * Returns connections in triangle pattern if all succeed
 */
export const rollRevengeLinkerConnections = (
  boardSize: number,
  existingConnections: BoardConnection[]
): BoardConnection[] => {
  const connections: BoardConnection[] = [];
  const rollChance = 20; // 20% per roll
  let successfulRolls = 0;

  // 3 separate rolls
  for (let i = 0; i < 3; i++) {
    if (Math.random() * 100 < rollChance) {
      successfulRolls++;
    }
  }

  if (successfulRolls === 0) return [];

  // Pick 3 random positions for triangle pattern
  const positions: number[] = [];
  const maxAttempts = 30;
  let attempts = 0;

  while (positions.length < 3 && attempts < maxAttempts) {
    attempts++;
    const pos = Math.floor(Math.random() * boardSize);
    if (!positions.includes(pos)) {
      positions.push(pos);
    }
  }

  if (positions.length < 3) return [];

  const [posA, posB, posC] = positions;

  // Create connections based on successful rolls
  // 1 success: A↔B
  // 2 successes: A↔B, B↔C
  // 3 successes: A↔B, B↔C, A↔C (triangle)

  if (successfulRolls >= 1 && !arePositionsConnected(existingConnections, posA, posB)) {
    connections.push(createConnection(posA, posB));
  }
  if (successfulRolls >= 2 && !arePositionsConnected(existingConnections, posB, posC)) {
    connections.push(createConnection(posB, posC));
  }
  if (successfulRolls >= 3 && !arePositionsConnected(existingConnections, posA, posC)) {
    connections.push(createConnection(posA, posC));
  }

  return connections;
};

/**
 * Get the fire spread multiplier for a position (Sympathetic Flames weapon)
 */
export const getFireSpreadMultiplier = (
  connections: BoardConnection[],
  position: number,
  linkedFireMultiplier: number
): number => {
  const isConnected = connections.some(
    conn => conn.positionA === position || conn.positionB === position
  );
  return isConnected ? linkedFireMultiplier : 1;
};

/**
 * Remove all connections involving a specific position
 * (used when a position is destroyed to clean up stale connections)
 */
export const removeConnectionsForPosition = (
  connections: BoardConnection[],
  position: number
): BoardConnection[] => {
  return connections.filter(
    conn => conn.positionA !== position && conn.positionB !== position
  );
};
