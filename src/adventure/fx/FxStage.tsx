/**
 * The stage: a layer over the whole fight that draws what is playing.
 *
 * It only reads the catalog row of each beat and the anchors' positions, so a
 * new event type or a new HUD part needs no change here. Everything is sized
 * from the cards on the board, so it scales with the screen.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { Anchors } from './anchors';
import { FX_COLOR } from './catalog';
import type { AnchorName, Beat, Point, Rect } from './types';
import type { FightFx } from './useFightFx';
import { Beam, centerOf, Comet, Flames, Flash, Ghost, Puff, Ring, Sparkles, Stamp, Starburst, Sweep, Tag, Ticks, unitOf } from './visuals';

/** Most orbs one beat sends, however many cards it touched */
const MAX_ORBS = 3;
/** Each orb leaves this long after the one before */
const ORB_GAP_MS = 45;
const RAINBOW = ['#F0483E', '#F5B800', '#16AA98', '#3B82F6', '#9333EA'];

interface Size { w: number; h: number }

/** Cards on the same line (within half a card of each other on that axis) */
const aligned = (rects: Rect[], axis: 'x' | 'y'): boolean =>
  rects.length >= 2 && rects.every(r => Math.abs(r[axis] - rects[0][axis]) < (axis === 'x' ? r.w : r.h) / 2);

/** A burst a little bigger than a card, but not a wide chip's whole width when it plays on the HUD */
const burstSize = (r: Rect): number => Math.min(r.w * 1.3, Math.max(r.h * 1.8, 44));

/**
 * Where the words pop for something that landed on this part of the HUD.
 * On the foe, the Set's own number sits on the portrait and the rest fan out
 * to its right in two columns; elsewhere they stack under the chip.
 */
const labelPoint = (to: AnchorName, r: Rect, lane: number, lead: boolean): Point => {
  if (to !== 'foe') return { x: r.x + r.w / 2, y: r.y + r.h + 13 + (lane % 3) * 18 };
  if (lead) return { x: r.x + r.w * 0.62, y: r.y + r.h * 0.42 };
  const n = Math.max(0, lane - 1);
  return { x: r.x + r.w + 46 + (n % 2) * 92, y: r.y + 13 + (Math.floor(n / 2) % 3) * 20 };
};

const BeatView: React.FC<{ beat: Beat; anchors: Anchors; size: Size }> = React.memo(({ beat, anchors, size }) => {
  const { row } = beat;
  const rectsOf = (slots: number[]) => slots.map(i => anchors.rect(`slot:${i}`)).filter((r): r is Rect => !!r);
  const middle: Rect = { x: size.w / 2 - 20, y: Math.min(120, size.h * 0.2), w: 40, h: 40 };
  const color = beat.sour ? FX_COLOR.sour : row.color;
  const labelColor = beat.sour ? FX_COLOR.sour : row.labelColor ?? row.color;

  if (beat.quiet) {
    const foe = anchors.rect('foe');
    const at = foe ? labelPoint('foe', foe, beat.lane, beat.lead) : { x: middle.x + 20, y: middle.y + beat.lane * 20 };
    return beat.label ? <Stamp at={at} text={beat.label} color={labelColor} tier={beat.tier} sticker={!beat.lead} maxX={size.w} /> : null;
  }

  const cards = rectsOf(beat.slots);
  const board = anchors.rect('board');
  const fighter = anchors.rect('fighter');
  const sample = cards[0] ?? anchors.rect('slot:0');
  const unit = sample ? unitOf(sample) : 90;
  const flight = beat.land - beat.at;
  const sourceRect = beat.source ? anchors.rect(beat.source.anchor) : null;
  const fromRect = row.from && row.from !== 'set' ? anchors.rect(row.from) : null;
  /** The foe's moves fly TO the board; everything else flies from it */
  const inbound = row.to === 'board';

  // Bad news does not twinkle
  const boardFx = beat.sour && row.board === 'sparkle' ? 'puff' : row.board;
  // Where the board effect plays: on its cards, or on the place the row starts from (the foe healing, the foe going down)
  const places = cards.length ? cards : row.board && fromRect ? [fromRect] : [];
  const boardDelay = inbound ? flight : 0;

  // What flies, from where, to where
  const targetRect = !beat.flies ? null : inbound ? cards[0] ?? board : row.to ? anchors.rect(row.to) : null;
  const end = targetRect ? centerOf(targetRect) : null;
  const launch = rectsOf(beat.launch);
  const starts: Point[] = !end
    ? []
    : inbound
      ? [centerOf(fromRect ?? middle)]
      : launch.length
        ? launch.slice(0, MAX_ORBS).map(centerOf)
        : [centerOf(sourceRect ?? fromRect ?? fighter ?? middle)];
  const orbSize = Math.max(12, Math.min(20, unit * 0.2)) + beat.tier * 4;

  // Where the words go. Only the Set's own number is bare; everything else is a tag, so it reads over whatever is under it.
  const label = beat.label;
  const sticker = !beat.lead;
  let labelAt: Point;
  if (end && targetRect && row.to && !inbound) labelAt = labelPoint(row.to, targetRect, beat.lane, beat.lead);
  else if (places.length) labelAt = { x: places[0].x + places[0].w / 2, y: places[0].y + places[0].h * 0.34 + (beat.lane % 3) * 20 };
  else if (row.sweep && board) labelAt = { x: board.x + board.w / 2, y: board.y + board.h * 0.3 + (beat.lane % 3) * 30 };
  else if (row.aura && fighter) labelAt = { x: fighter.x - 8, y: fighter.y + fighter.h + 14 + (beat.lane % 3) * 18 };
  else {
    const chip = row.bump?.map(a => anchors.rect(a)).find(Boolean) ?? sourceRect ?? fromRect;
    // nowhere of its own: the top of the board
    labelAt = chip ? labelPoint('board', chip, beat.lane, false) : board ? { x: board.x + board.w / 2, y: board.y + 18 + (beat.lane % 3) * 22 } : { x: middle.x + 20, y: middle.y };
  }
  const labelDelay = end ? flight : inbound ? flight + 60 : 70;

  // Lines: a laser along a row or column, or from whoever fired to each card; a bolt from card to card
  const lines: { from: Point; to: Point; delay: number }[] = [];
  if (row.board === 'beam' && cards.length) {
    const pad = unit * 0.12;
    if (aligned(cards, 'y')) {
      const y = cards[0].y + cards[0].h / 2;
      lines.push({ from: { x: Math.min(...cards.map(r => r.x)) - pad, y }, to: { x: Math.max(...cards.map(r => r.x + r.w)) + pad, y }, delay: 0 });
    } else if (aligned(cards, 'x')) {
      const x = cards[0].x + cards[0].w / 2;
      lines.push({ from: { x, y: Math.min(...cards.map(r => r.y)) - pad }, to: { x, y: Math.max(...cards.map(r => r.y + r.h)) + pad }, delay: 0 });
    } else {
      const origin = centerOf(sourceRect ?? fighter ?? middle);
      cards.forEach((r, i) => lines.push({ from: origin, to: centerOf(r), delay: i * 50 }));
    }
  }
  if (row.board === 'zap' && cards.length) {
    const points = cards.map(centerOf);
    if (points.length === 1 && sourceRect) points.unshift(centerOf(sourceRect));
    for (let i = 1; i < points.length; i++) lines.push({ from: points[i - 1], to: points[i], delay: (i - 1) * 70 });
  }
  const laser = row.board === 'beam';
  const thickness = laser ? Math.max(10, unit * 0.2) : Math.max(7, unit * 0.08);

  return (
    <>
      {row.sweep && board && <Sweep rect={board} kind={row.sweep} />}

      {places.map((r, i) => {
        const delay = boardDelay + i * 45;
        const key = `${beat.key}-${i}`;
        switch (boardFx) {
          case 'burst':
            return (
              <React.Fragment key={key}>
                <Starburst at={centerOf(r)} size={burstSize(r)} color={color} delay={delay} />
                <Ticks at={centerOf(r)} size={burstSize(r) * 1.3} color={color} delay={delay + 60} />
              </React.Fragment>
            );
          case 'beam':
            return <Flash key={key} rect={r} color={color} delay={60 + i * 30} />;
          case 'zap':
            return <Ring key={key} at={centerOf(r)} size={unitOf(r) * 0.9} color={color} delay={i * 70 + 40} />;
          case 'flame':
            return <Flames key={key} rect={r} color={color} delay={delay} />;
          case 'sparkle':
            return <Sparkles key={key} rect={r} color={color} delay={delay} />;
          case 'puff':
            return <Puff key={key} rect={r} color={color} delay={delay} />;
          case 'ring':
            return (
              <React.Fragment key={key}>
                <Ring at={centerOf(r)} size={unitOf(r) * 1.25} color={color} delay={delay} width={4} />
                <Ring at={centerOf(r)} size={unitOf(r) * 1.7} color={color} delay={delay + 90} />
              </React.Fragment>
            );
          default:
            return null;
        }
      })}

      {lines.map((l, i) => (
        <Beam key={`${beat.key}-l${i}`} from={l.from} to={l.to} delay={l.delay} thickness={thickness} color={color} core={laser} hold={laser ? 150 : 70} />
      ))}

      {row.aura && fighter && (
        <>
          <Ring at={centerOf(fighter)} size={fighter.w * 1.5} color={color} width={4} ms={380} />
          <Ring at={centerOf(fighter)} size={fighter.w * 2.2} color={color} delay={110} ms={420} />
        </>
      )}

      {end && starts.map((from, i) => (
        <Comet
          key={`${beat.key}-o${i}`}
          from={from}
          to={end}
          delay={i * ORB_GAP_MS}
          ms={flight}
          size={orbSize}
          color={row.orb === 'rainbow' ? RAINBOW[(i * 2) % RAINBOW.length] : color}
          bend={(i % 2 ? 1 : -1) * (12 + i * 7)}
        />
      ))}
      {end && !inbound && (
        <>
          <Ring at={end} size={36 + beat.tier * 14} color={color} delay={flight} />
          {beat.damage > 0 && <Ticks at={end} size={54 + beat.tier * 16} color={color} delay={flight} />}
        </>
      )}

      {beat.source && beat.named && sourceRect && (
        // Three rows, by step, so the names of weapons that fire one after another do not land on each other
        <Tag at={{ x: sourceRect.x + sourceRect.w / 2, y: sourceRect.y + sourceRect.h + 3 + (beat.step % 3) * 16 }} text={beat.source.name} maxX={size.w} />
      )}
      {label && <Stamp at={labelAt} text={label} color={labelColor} tier={beat.tier} delay={labelDelay} sticker={sticker} sour={beat.sour} maxX={size.w} />}
    </>
  );
});
BeatView.displayName = 'BeatView';

/** Everything that is playing right now, drawn over the fight. Taps pass through, except on ghost cards. */
export const FxStage: React.FC<{ fx: FightFx; anchors: Anchors; size: Size }> = ({ fx, anchors, size }) => (
  <View style={st.stage} pointerEvents="box-none" testID="fx-stage">
    {fx.ghosts.map(g => {
      const rect = anchors.rect(`slot:${g.slot}`);
      return rect ? <Ghost key={g.key} rect={rect} card={g.card} broken={g.broken} how={g.how} color={g.color} /> : null;
    })}
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {fx.beats.map(b => <BeatView key={b.key} beat={b} anchors={anchors} size={size} />)}
    </View>
  </View>
);

const st = StyleSheet.create({
  stage: { ...StyleSheet.absoluteFillObject, zIndex: 240 },
});
