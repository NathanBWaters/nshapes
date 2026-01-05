import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { useParticles } from '@/hooks/useParticles';

interface ConfettiBurstProps {
  trigger: boolean;
  count?: number;
  origin?: { x: number; y: number };
}

export function ConfettiBurst({
  trigger,
  count = 30,
  origin,
}: ConfettiBurstProps) {
  const { spawnParticles, Particles } = useParticles();
  const hasTriggered = useRef(false);

  useEffect(() => {
    if (trigger && !hasTriggered.current) {
      hasTriggered.current = true;
      const { width } = Dimensions.get('window');
      const defaultOrigin = origin || { x: width / 2, y: 100 };
      spawnParticles(count, defaultOrigin, 'confetti');
    }

    if (!trigger) {
      hasTriggered.current = false;
    }
  }, [trigger, count, origin, spawnParticles]);

  return <Particles />;
}
