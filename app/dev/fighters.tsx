/**
 * [TP-14] Dev Critter & Relic Studio (/dev/fighters) — thin unlocked-all
 * wrapper around the shared `CritterGallery` component.
 */
import React from 'react';
import CritterGallery from '@/adventure/components/CritterGallery';

export default function DevFightersPage() {
  return <CritterGallery mode="studio" />;
}
