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
  'rainbow-charm': { kind: 'hunt', tip: 'Look for three cards with nothing in common: every trait all different. Pairs brilliantly with Clarity Lens — simplified traits no longer break Rainbows.', events: ['rainbow'] },
  'flint-spark': { kind: 'luck', tip: 'Burning cards carry your Set multipliers and can jump to neighbours as they burn out. Skip burning cards: they are already paying you.', look: FIRE, events: ['fire'], calls: ['Burn'] },
  'prismatic-ray': { kind: 'luck', tip: 'A laser clears a whole row or column, so a bigger board means a bigger laser.', events: ['laser'] },
  'chaos-shard': { kind: 'luck', tip: 'Each bounce can bounce again. Nothing to aim: just keep making Sets.', events: ['ricochet'] },
  'war-drum': { kind: 'rhythm', tip: 'Speed is everything. Three quick Sets slam the foe and power up the whole board, so open with fast, easy Sets.', events: ['empowered'] },
  'rally-horn': { kind: 'rhythm', tip: 'Count to four! Rally Horn multiplies with your Set multipliers, so save a Rainbow, Shading Surge, or Parry for the wave opener and every 4th Set.' },
  pinata: { kind: 'luck', tip: 'Every wave starts with a piñata hanging and Sets hang more. Crack it once, then pop it inside a big Set (like a Rainbow or Surge) for huge multiplied damage.', look: { text: 'A card with a bonus badge that survives its first match.' }, events: ['pinata', 'pinata_break'] },
  'amplifier-coil': { kind: 'luck', tip: 'It doubles whatever weapon fires next, so it is only as good as the other weapons beside it.', events: ['doubled', 'double_ready'] },

  // ── Tricks ────────────────────────────────────────────────────────────────
  magnet: { kind: 'hunt', tip: 'Before each Set, find the marked card and look for a Set through it. The mark moves after you use it.', look: { icon: 'lorc/magnet', color: '#DC2626', text: 'A red magnet in the corner of one card.' }, calls: ['Magnet'] },
  'bounty-poster': { kind: 'hunt', tip: 'Read the WANTED chip, then favour Sets full of that value. A Set of three wanted cards pays three times.', look: { text: 'The WANTED chip above the board names the value and how many are left.' }, calls: ['Bounty'] },
  'mirror-shard': { kind: 'hunt', tip: 'After a Set, look at the highlighted spots it just refilled: your next Set should use one of them.', calls: ['Mirror'] },
  'odd-one-out': { kind: 'hunt', tip: 'Look for three cards that are nearly identical, with just one thing different.', calls: ['Odd one out'] },
  'collectors-album': { kind: 'hunt', tip: 'Every page you stamp hits for +3, and completing the final page unleashes a huge bonus — save the last stamp for a Rainbow or ×2.', look: { text: 'The album chip above the board shows which pages are filled.' }, calls: ['Album'] },
  snowball: { kind: 'rhythm', tip: 'It grows with every clean Set and a mistake halves it. When unsure, take a second to check rather than guess.', look: { text: 'The snowball chip above the board shows the bonus right now.' }, calls: ['Snowball'] },
  'glass-sword': { kind: 'rhythm', tip: 'Big damage for playing fast and clean (with extra breathing room on 4-5 traits). If it shatters, a Rainbow Set or 3 clean Sets in a row reforges it.', look: { text: 'The sword chip above the board counts down the seconds you have left.' }, calls: ['Glass Sword'] },
  'devils-bargain': { kind: 'always', tip: 'You start a heart down for a bonus on every Set. It gets stronger the more hurt you are, so it loves low-heart fighters.', calls: ["Devil's Bargain"] },
  tightrope: { kind: 'hunt', tip: 'Stay close: your next Set should use one of the highlighted spots touching your last Set. Stepping off the rope deals half.', calls: ['Tightrope'] },
  understudy: { kind: 'always', tip: 'Put it directly to the right of your best charm to copy it at the higher of both levels. Does nothing in the first slot.' },

  // ── Board gambles ─────────────────────────────────────────────────────────
  'cursed-idol': { kind: 'gamble', tip: 'A cursed card is out of play for 10 seconds. If it turns into a ×2 card, build your biggest Set around it.', look: { icon: 'lorc/cursed-star', color: '#7E22CE', text: 'A purple wash and star: cursed. A gold star marked ×2: the reward.' }, calls: ['Curse'] },
  'chain-gang': { kind: 'gamble', tip: 'The two chained cards are always part of a real Set. Find the third card. Matching only one of them wastes it.', look: { icon: 'lorc/crossed-chains', color: '#475569', text: 'Chains in the corner of two cards.' }, calls: ['Chain Gang'] },
  'thorn-bush': { kind: 'gamble', tip: 'A thorn card is on a timer. Drop what you are doing and clear it: the bonus is good and the penalty is a heart.', look: { icon: 'lorc/thorny-vine', color: '#15803D', text: 'A green vine in the corner of a card.' }, calls: ['Thorns'] },
  rust: { kind: 'gamble', tip: 'Old cards get weaker, then the oldest one turns golden. Leave one card alone on purpose and cash it in.', look: { icon: 'delapouite/rusty-sword', color: '#B45309', text: 'A rusty sword with how much damage the card has lost.' } },
  'tar-pit': { kind: 'gamble', tip: 'Cards in the sticky row need two matches, but every Set that touches the row pays. Keep working that row.', look: { icon: 'delapouite/sticky-boot', color: '#1F2937', text: 'A boot in the corner, with the matches the card still needs.' }, calls: ['Tar Pit'] },
  decoy: { kind: 'gamble', tip: 'A secret game: nothing marks a decoy. If two cards look almost the same, one may be a decoy. Match them together.', calls: ['Decoy'] },
  'long-fuse': { kind: 'gamble', tip: 'Wait for the fuse to turn red (its last 5 seconds), then match it. Too early pays nothing, too late leaves a dud.', look: { icon: 'delapouite/time-dynamite', color: '#DC2626', text: 'Dynamite in the corner: grey while it waits, red when it is time.' }, calls: ['Short fuse'] },
  'ice-block': { kind: 'gamble', tip: 'You cannot use the frozen card, so plan around it. After 7 of your Sets it thaws: match it for the biggest single bonus in the game.', look: { icon: 'lorc/ice-cube', color: '#0284C7', text: 'A blue wash and an ice cube with the Sets left until it thaws.' } },
  'greedy-chest': { kind: 'gamble', tip: 'Starts modest, then climbs fast every Set you pass it by. Let it fatten up for a huge cash-in, but open it before a risky guess resets it to the floor.', look: { icon: 'delapouite/mimic-chest', color: '#B45309', text: 'A chest with the damage inside it right now.' }, calls: ['Greedy Chest'] },
  'hot-potato': { kind: 'gamble', tip: 'Match the hot card for a bonus. While it is out, mistakes cost double, so do not guess.', look: { icon: 'delapouite/potato', color: '#EA580C', text: 'An orange potato in the corner. It jumps to a neighbour every 10 seconds.' }, calls: ['Hot Potato'] },
  'twin-seed': { kind: 'gamble', tip: 'Twins can never be in the same Set. Match either one and the other pops for free damage.', look: { icon: 'delapouite/gemini', color: '#7C3AED', text: 'The twins sign in the corner of two identical cards.' }, calls: ['Twin'] },
  'fog-lantern': { kind: 'gamble', tip: 'A face-down card is a smaller board for 8 seconds. Remember where it is: it flips up as a power card.', look: { icon: 'lorc/lantern-flame', color: '#B45309', text: 'A lantern on the back of a face-down card.' }, calls: ['The fog lifts'] },

  // ── Board ─────────────────────────────────────────────────────────────────
  'field-stone': { kind: 'always', tip: 'More cards means more Sets to choose from, higher Catalyst odds, and overflow Power cards whenever your board reaches 18+ cards.' },
  'growth-seed': { kind: 'luck', tip: 'Each growth makes the whole board hit harder, and even at max board size it keeps empowering every card.', events: ['grow'], calls: ['Bloom'] },
  'clarity-lens': { kind: 'rhythm', tip: 'Pure board clarity: strips away one trait (and up to two traits at Lv 3+) so Sets and Rainbows jump right off the screen.', events: ['simplified'] },
  'wild-card': { kind: 'hunt', tip: 'A wild card makes a Set with ANY two other cards. Use it with your two strongest cards.', look: { icon: 'delapouite/card-joker', color: '#7C3AED', text: 'A joker in place of the shapes.' } },

  // ── Hearts & graces ───────────────────────────────────────────────────────
  'mending-charm': { kind: 'luck', tip: 'Pure survival tank: heals when hurt and banks Over-Shield mistake protection whenever it overheals at full hearts.', events: ['heal'] },
  'life-vessel': { kind: 'always', tip: 'Pure HP tank: stacks extra max hearts and heals at the start of every wave so you can weather long multi-wave gauntlets.' },
  'life-link': { kind: 'rhythm', tip: 'Starts every wave with a mistake shield, and every 4th Set at full hearts blasts the board. If you do lose a heart, it blasts back and blasts can heal you.' },
  'soul-harvest': { kind: 'luck', tip: 'Destroying extra cards (blasts, fire, lasers, ricochets) can heal you, and every heal hits the foe back — even at full hearts.' },
  'revenge-linker': { kind: 'rhythm', tip: 'Wires a Tripwire link every 4th Set and on trap defuses, and detonates linked cards while weaving more if you take a hit.', look: LINK },
  'second-chance': { kind: 'always', tip: 'Safety Cushion: stacks extra starting graces and can refund a spent grace so near-misses keep you safely in the fight.', events: ['grace'] },
  'fortune-token': { kind: 'luck', tip: 'Grace Generator: earns graces on Sets and tops you up at the start of every wave for steady, fearless play.' },
  'grace-conduit': { kind: 'reaction', tip: 'Defensive Retaliator: turns near-miss grace saves into high-chance row or column laser counter-punches.' },
  'chaos-conduit': { kind: 'luck', tip: 'Blast-to-Grace Bridge: explosions mint new graces, and spending a grace detonates a 2×2 blast right back.' },

  // ── Hints, coins & XP ─────────────────────────────────────────────────────
  'seeker-lens': { kind: 'luck', tip: 'Hint Hoarder: hoard your unspent hints! Every hint you keep in reserve adds flat Set damage before multipliers.', events: ['hint'] },
  'crystal-orb': { kind: 'always', tip: 'Active Hint Bank: fills extra hint slots at fight start, and tapping a hint freezes both the clock and foe for tactical breathing room.' },
  'oracle-eye': { kind: 'hunt', tip: 'Idle Radar: points out a card after 4 quiet seconds and refunds clock time whenever you finish a hinted Set.' },
  'mystic-sight': { kind: 'rhythm', tip: '2-Card Precision Sniper: auto-hints reveal 2 cards at once, hinted Sets snipe for bonus damage, and every 3rd hinted Set primes ×1.5.' },
  'fortunes-favor': { kind: 'luck', tip: 'Shop & Coin Magnate: boosts every coin source and drops steady windfalls for intermission shops and Camp upgrades.', events: ['coins'] },
  'fortunes-blessing': { kind: 'hunt', tip: 'Gilded Alchemist: gilds a card each wave, doubles gold-card coin payouts, and turns bonus cards and coins into fresh hints.' },
  'scholars-tome': { kind: 'luck', tip: 'Rapid Level-Up Engine: accelerates XP gains and unlocks an extra pick choice at Lv 3+ so you draft your mid-fight build faster.' },
  'wisdom-chain': { kind: 'rhythm', tip: 'Dividend Loop: boosts coins, surges XP every 5th Set, turns XP into coins, and charges every wave opener with a Set multiplier.' },

  // ── Time & evolutions ─────────────────────────────────────────────────────
  'chrono-shard': { kind: 'always', tip: 'Adds extra seconds on the clock and slows time down right from the start. Does nothing on levels that count moves instead.' },
  'time-drop': { kind: 'luck', tip: 'Each drop adds seconds. A fight can gain at most as much time as it started with.', events: ['time_gain'] },
  'temporal-rift': { kind: 'luck', tip: 'Time gains can echo a free Set. Best beside another time weapon.' },
  'catalyst-prism': { kind: 'hunt', tip: 'Rainbow Sets (every trait different) hit harder and bring Catalysts, which start evolutions.', events: ['catalyst_spawn'] },
  'encore-mask': { kind: 'reaction', tip: 'Pair with any two weapons that form a recipe: it extends evolutions by 5s, boosts Sets while evolved, and ends every evolution with a blast and a ×2 next Set.' },

  // ── Echoes & links ────────────────────────────────────────────────────────
  'echo-stone': { kind: 'luck', tip: 'An echo is a free Set made for you. Every weapon that fires on a Set can fire on the echo too.', events: ['echo'] },
  'chain-reaction': { kind: 'luck', tip: 'Echoes can come in pairs. Best beside another echo weapon.' },
  'cascade-core': { kind: 'luck', tip: 'Echoes can start fires. Best beside another echo weapon.', look: FIRE },
  connector: { kind: 'luck', tip: 'Active Weaver: links matched spots so blasts, burns, and lasers clear both, and preserves your web between waves at Lv 3+.', look: LINK, events: ['link', 'link_burst'] },
  'web-weaver': { kind: 'always', tip: 'Opening Web: starts every wave pre-wired with links for immediate turn-one chain bursts.', look: LINK },
  'neural-network': { kind: 'luck', tip: 'Branching Mesh: every new link can fork into a chain of linked cards for exponential board clears.', look: LINK },
  'echo-chamber': { kind: 'reaction', tip: 'Chrono-Link Conduit: every card destroyed through a link adds generous time back onto the clock.', look: LINK },
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
