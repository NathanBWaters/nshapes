/**
 * The weapon guide: what a player needs to know about a weapon beyond its
 * numbers. ONE table, read everywhere a weapon is explained:
 *
 *   before a fight   LevelPreview → WeaponExplainer
 *   after a fight    FightReplay  → WeaponExplainer, with what it did
 *   during a fight   the band (src/audio) asks who caused an event
 *
 * A weapon's "what it does" text and numbers are NOT here: they come from the
 * weapon itself (`description`, built from its current numbers), so they can
 * never drift. This table adds what numbers can't say: when it works, what to
 * look for on a card, how to play it, and how to recognise it in a fight log.
 *
 * ADDING A WEAPON: add a row. __tests__/weaponGuide.test.ts fails for any
 * Armory weapon without one (and for a row that points at no weapon).
 */
import type { IconName } from '@/components/Icon';
import type { RunEventType } from '../types';

/** When a weapon works, in one word the player can sort weapons by */
export type WeaponKind = 'always' | 'luck' | 'rhythm' | 'hunt' | 'gamble' | 'reaction';

export const WEAPON_KINDS: Record<WeaponKind, { label: string; blurb: string; color: string }> = {
  always: { label: 'Always on', blurb: 'Works from the first second. Nothing to do.', color: '#0F766E' },
  luck: { label: 'Luck', blurb: 'Has a chance to fire on every Set you make.', color: '#B45309' },
  rhythm: { label: 'Rhythm', blurb: 'Pays for how you play: counting Sets, keeping pace.', color: '#1D4ED8' },
  hunt: { label: 'Hunt', blurb: 'Gives you something to look for on the board.', color: '#7C3AED' },
  gamble: { label: 'Gamble', blurb: 'Makes your board harder. Pull it off and it pays the most.', color: '#BE123C' },
  reaction: { label: 'Reaction', blurb: 'Wakes up when something else happens.', color: '#475569' },
};

export interface WeaponGuide {
  kind: WeaponKind;
  /** How to get the most out of it: one or two plain sentences */
  tip: string;
  /** What to look for: a card marker (icon as drawn on the card) or a place on screen */
  look?: { icon?: IconName; color?: string; text: string };
  /** Fight events with no rule behind them that this weapon is the cause of (a blast, a heal…) */
  events?: RunEventType[];
  /** Callout texts that mean this weapon paid out (trick weapons announce themselves by name) */
  calls?: string[];
}

const FIRE = { icon: 'lorc/campfire', color: '#EF4444', text: 'A flame in the corner of a card: it is burning and will be destroyed.' } as const;
const LINK = { icon: 'lorc/linked-rings', color: '#383838', text: 'Rings in the corner of two cards: destroy one and the other goes too.' } as const;

export const WEAPON_GUIDE: Record<string, WeaponGuide> = {
  // ── Damage ────────────────────────────────────────────────────────────────
  'blast-powder': { kind: 'luck', tip: 'Blasts hit the cards NEXT to your Set, so Sets in the middle of the board blast more cards than Sets on the edge.', events: ['blast'] },
  'flint-spark': { kind: 'luck', tip: 'Fire spreads on its own. Do not chase burning cards: they are already paying you.', look: FIRE, events: ['fire'], calls: ['Burn'] },
  'prismatic-ray': { kind: 'luck', tip: 'A laser clears a whole row or column, so a bigger board means a bigger laser.', events: ['laser'] },
  'chaos-shard': { kind: 'luck', tip: 'Each bounce can bounce again. Nothing to aim: just keep making Sets.', events: ['ricochet'] },
  'war-drum': { kind: 'rhythm', tip: 'Speed is everything. Three quick Sets power up the whole board, and it stacks, so open with easy Sets.', events: ['empowered'] },
  'rally-horn': { kind: 'rhythm', tip: 'Count to four. Save a Rainbow or a strong card for the 4th Set and for the first Set of a wave.', events: ['charged'] },
  pinata: { kind: 'luck', tip: 'A piñata card needs one extra match to break. Go back for it: the break is worth far more than a normal Set.', look: { text: 'A card with a bonus badge that survives its first match.' }, events: ['pinata', 'pinata_break'] },
  'amplifier-coil': { kind: 'luck', tip: 'It doubles whatever weapon fires next, so it is only as good as the other weapons beside it.', events: ['doubled', 'double_ready'] },

  // ── Tricks ────────────────────────────────────────────────────────────────
  magnet: { kind: 'hunt', tip: 'Before each Set, find the marked card and look for a Set through it. The mark moves after you use it.', look: { icon: 'lorc/magnet', color: '#DC2626', text: 'A red magnet in the corner of one card.' }, calls: ['Magnet'] },
  'bounty-poster': { kind: 'hunt', tip: 'Read the WANTED chip, then favour Sets full of that value. A Set of three wanted cards pays three times.', look: { text: 'The WANTED chip above the board names the value and how many are left.' }, calls: ['Bounty'] },
  'mirror-shard': { kind: 'hunt', tip: 'After a Set, look at the three spots it just refilled: your next Set should use one of them.', calls: ['Mirror'] },
  'odd-one-out': { kind: 'hunt', tip: 'Look for three cards that are nearly identical, with just one thing different.', calls: ['Odd one out'] },
  'collectors-album': { kind: 'hunt', tip: 'Fill the easy pages first and keep the last one for when a Rainbow or ×2 is ready: the Set that completes the album is the big one.', look: { text: 'The album chip above the board shows which pages are filled.' }, calls: ['Album'] },
  snowball: { kind: 'rhythm', tip: 'It grows with every Set and a mistake halves it. When unsure, take a second to check rather than guess.', look: { text: 'The snowball chip above the board shows the bonus right now.' }, calls: ['Snowball'] },
  'glass-sword': { kind: 'rhythm', tip: 'A big bonus for playing fast AND clean. If you stall, take any Set you can see: the clock breaks it as surely as a mistake.', look: { text: 'The sword chip above the board counts down the seconds you have left.' }, calls: ['Glass Sword'] },
  'devils-bargain': { kind: 'always', tip: 'You start a heart down for a bonus on every Set. It gets stronger the more hurt you are, so it loves low-heart fighters.', calls: ["Devil's Bargain"] },
  tightrope: { kind: 'hunt', tip: 'Stay close: your next Set should touch or reuse the spots of your last one. A Set far away deals half.', calls: ['Tightrope'] },
  understudy: { kind: 'always', tip: 'Put it directly to the right of your best charm. It does nothing in the first slot.' },

  // ── Board gambles ─────────────────────────────────────────────────────────
  'cursed-idol': { kind: 'gamble', tip: 'A cursed card is out of play for 10 seconds. If it turns into a ×2 card, build your biggest Set around it.', look: { icon: 'lorc/cursed-star', color: '#7E22CE', text: 'A purple wash and star: cursed. A gold star marked ×2: the reward.' }, calls: ['Curse'] },
  'chain-gang': { kind: 'gamble', tip: 'The two chained cards are always part of a real Set. Find the third card. Matching only one of them wastes it.', look: { icon: 'lorc/crossed-chains', color: '#475569', text: 'Chains in the corner of two cards.' }, calls: ['Chain Gang'] },
  'thorn-bush': { kind: 'gamble', tip: 'A thorn card is on a timer. Drop what you are doing and clear it: the bonus is good and the penalty is a heart.', look: { icon: 'lorc/thorny-vine', color: '#15803D', text: 'A green vine in the corner of a card.' }, calls: ['Thorns'] },
  rust: { kind: 'gamble', tip: 'Old cards get weaker, then the oldest one turns golden. Leave one card alone on purpose and cash it in.', look: { icon: 'delapouite/rusty-sword', color: '#B45309', text: 'A rusty sword with how much damage the card has lost.' } },
  'tar-pit': { kind: 'gamble', tip: 'Cards in the sticky row need two matches, but every Set that touches the row pays. Keep working that row.', look: { icon: 'delapouite/sticky-boot', color: '#1F2937', text: 'A boot in the corner, with the matches the card still needs.' }, calls: ['Tar Pit'] },
  decoy: { kind: 'gamble', tip: 'A secret game: nothing marks a decoy. If two cards look almost the same, one may be a decoy. Match them together.', calls: ['Decoy'] },
  'long-fuse': { kind: 'gamble', tip: 'Wait for the fuse to turn red (its last 5 seconds), then match it. Too early pays nothing, too late leaves a dud.', look: { icon: 'delapouite/time-dynamite', color: '#DC2626', text: 'Dynamite in the corner: grey while it waits, red when it is time.' }, calls: ['Short fuse'] },
  'ice-block': { kind: 'gamble', tip: 'You cannot use the frozen card, so plan around it. After 7 of your Sets it thaws: match it for the biggest single bonus in the game.', look: { icon: 'lorc/ice-cube', color: '#0284C7', text: 'A blue wash and an ice cube with the Sets left until it thaws.' } },
  'greedy-chest': { kind: 'gamble', tip: 'The chest grows every Set you leave it and a mistake empties it. Greed pays, but cash it in before a risky guess.', look: { icon: 'delapouite/mimic-chest', color: '#B45309', text: 'A chest with the damage inside it right now.' }, calls: ['Greedy Chest'] },
  'hot-potato': { kind: 'gamble', tip: 'Match the hot card for a bonus. While it is out, mistakes cost double, so do not guess.', look: { icon: 'delapouite/potato', color: '#EA580C', text: 'An orange potato in the corner. It jumps to a neighbour every 10 seconds.' }, calls: ['Hot Potato'] },
  'twin-seed': { kind: 'gamble', tip: 'Twins can never be in the same Set. Match either one and the other pops for free damage.', look: { icon: 'delapouite/gemini', color: '#7C3AED', text: 'The twins sign in the corner of two identical cards.' }, calls: ['Twin'] },
  'fog-lantern': { kind: 'gamble', tip: 'A face-down card is a smaller board for 8 seconds. Remember where it is: it flips up as a power card.', look: { icon: 'lorc/lantern-flame', color: '#B45309', text: 'A lantern on the back of a face-down card.' }, calls: ['The fog lifts'] },

  // ── Board ─────────────────────────────────────────────────────────────────
  'field-stone': { kind: 'always', tip: 'More cards means more Sets to choose from. It makes every other weapon a little better.' },
  'growth-seed': { kind: 'luck', tip: 'Each growth makes the whole board hit harder, for the rest of the fight. Best in long fights.', events: ['grow'], calls: ['Bloom'] },
  'clarity-lens': { kind: 'rhythm', tip: 'For 10 seconds one trait stops mattering, so Sets are much easier to see. Go fast while it lasts.', events: ['simplified'] },
  'wild-card': { kind: 'hunt', tip: 'A wild card makes a Set with ANY two other cards. Use it with your two strongest cards.', look: { icon: 'delapouite/card-joker', color: '#7C3AED', text: 'A joker in place of the shapes.' } },

  // ── Hearts & graces ───────────────────────────────────────────────────────
  'mending-charm': { kind: 'luck', tip: 'It heals when you are hurt and hits the foe when you are not. Never wasted.', events: ['heal'] },
  'life-vessel': { kind: 'always', tip: 'An extra heart, and a small bonus while your hearts are full. Play carefully and it pays twice.' },
  'life-link': { kind: 'reaction', tip: 'Losing a heart sets off a blast. It turns a bad moment into damage.' },
  'soul-harvest': { kind: 'luck', tip: 'Every card you destroy can heal you, so pair it with weapons that destroy lots of cards (blasts, fire, lasers).' },
  'revenge-linker': { kind: 'reaction', tip: 'Only wakes up when you lose a heart. Strong on fighters that live at low hearts.', look: LINK },
  'second-chance': { kind: 'always', tip: 'A grace forgives a Set that is wrong by one trait. This gives you one more, and each save hits back.', events: ['grace'] },
  'fortune-token': { kind: 'luck', tip: 'Graces let you guess when you are nearly sure. More graces, bolder play.' },
  'grace-conduit': { kind: 'reaction', tip: 'Each grace you spend can fire a laser. A near miss becomes an attack.' },
  'chaos-conduit': { kind: 'luck', tip: 'Blasts can hand you graces. Best beside another blast weapon.' },

  // ── Hints, coins & XP ─────────────────────────────────────────────────────
  'seeker-lens': { kind: 'luck', tip: 'Hints pile up. Spend them when you are stuck: an unused hint is worth nothing.', events: ['hint'] },
  'crystal-orb': { kind: 'always', tip: 'Every hint you use also hits the foe, so use your hints. Do not save them.' },
  'oracle-eye': { kind: 'reaction', tip: 'When you go quiet it points out a card of a Set. Slow, careful Sets deal a little more.', events: ['patience'] },
  'mystic-sight': { kind: 'rhythm', tip: 'Every 3rd Set hits harder. Count along and save a strong Set for the third.' },
  'fortunes-favor': { kind: 'luck', tip: 'Extra coins for the shop between waves and for Camp afterwards. Coins are kept even if you lose.', events: ['coins'] },
  'fortunes-blessing': { kind: 'luck', tip: 'Coins can turn into hints. Best with another coin weapon.' },
  'scholars-tome': { kind: 'luck', tip: 'More XP means more level-ups, and every level-up is a free weapon. Strongest early in a fight.' },
  'wisdom-chain': { kind: 'luck', tip: 'XP can turn into coins. Best with another XP weapon.' },

  // ── Time & evolutions ─────────────────────────────────────────────────────
  'chrono-shard': { kind: 'always', tip: 'More seconds on the clock means more Sets. Does nothing on levels that count moves instead.' },
  'time-drop': { kind: 'luck', tip: 'Each drop adds seconds. A fight can gain at most as much time as it started with.', events: ['time_gain'] },
  'temporal-rift': { kind: 'luck', tip: 'Time gains can echo a free Set. Best beside another time weapon.' },
  'catalyst-prism': { kind: 'hunt', tip: 'Rainbow Sets (every trait different) hit harder and bring Catalysts, which start evolutions.', events: ['catalyst_spawn'] },
  'encore-mask': { kind: 'reaction', tip: 'Only works with evolutions, so bring two weapons that make a recipe. Does nothing alone.' },

  // ── Echoes & links ────────────────────────────────────────────────────────
  'echo-stone': { kind: 'luck', tip: 'An echo is a free Set made for you. Every weapon that fires on a Set can fire on the echo too.', events: ['echo'] },
  'chain-reaction': { kind: 'luck', tip: 'Echoes can come in pairs. Best beside another echo weapon.' },
  'cascade-core': { kind: 'luck', tip: 'Echoes can start fires. Best beside another echo weapon.', look: FIRE },
  connector: { kind: 'luck', tip: 'Linked cards fall together, so every blast, burn or laser that hits one hits both.', look: LINK, events: ['link', 'link_burst'] },
  'web-weaver': { kind: 'always', tip: 'You start with links already on the board. Pair it with weapons that destroy cards.', look: LINK },
  'neural-network': { kind: 'luck', tip: 'Links can make more links. Best beside another link weapon.', look: LINK },
  'echo-chamber': { kind: 'reaction', tip: 'Every card destroyed through a link adds time. Needs links, so bring a link weapon.', look: LINK },
};

const UNKNOWN: WeaponGuide = { kind: 'always', tip: '' };

export const hasWeaponGuide = (id: string): boolean => id in WEAPON_GUIDE;
/** The guide row of a weapon. Never throws: a weapon with no row gets an empty one (and fails the test). */
export const weaponGuide = (id: string): WeaponGuide => WEAPON_GUIDE[id] ?? UNKNOWN;

/** Which held weapon an event with no rule behind it belongs to (callouts first, then event kinds). */
export const ownerOfEvent = (type: RunEventType, text: string | undefined, held: readonly string[]): string | null => {
  if (text) for (const id of held) if (WEAPON_GUIDE[id]?.calls?.some(c => text.startsWith(c))) return id;
  for (const id of held) if (WEAPON_GUIDE[id]?.events?.includes(type)) return id;
  return null;
};
