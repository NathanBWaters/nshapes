import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';

export type ParticleType = 'sparkle' | 'confetti' | 'explosion';

interface Particle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  opacity: number;
  scale: number;
  color: string;
  type: ParticleType;
  lifetime: number;
  maxLifetime: number;
}

interface ParticleOrigin {
  x: number;
  y: number;
}

const PARTICLE_COLORS = {
  sparkle: ['#FFDE00', '#FFFFFF', '#FFE54C'],
  confetti: ['#FFDE00', '#16AA98', '#FF9538', '#FF7169', '#1976D2', '#FFFFFF'],
  explosion: ['#FF9538', '#FF7169', '#FFDE00', '#383838'],
};

const generateParticle = (
  origin: ParticleOrigin,
  type: ParticleType,
  index: number
): Particle => {
  const colors = PARTICLE_COLORS[type];
  const color = colors[Math.floor(Math.random() * colors.length)];
  const angle = Math.random() * Math.PI * 2;

  let speed: number;
  let lifetime: number;

  switch (type) {
    case 'sparkle':
      speed = 1 + Math.random() * 2;
      lifetime = 1000 + Math.random() * 500;
      break;
    case 'confetti':
      speed = 3 + Math.random() * 4;
      lifetime = 1500 + Math.random() * 1000;
      break;
    case 'explosion':
      speed = 5 + Math.random() * 8;
      lifetime = 400 + Math.random() * 200;
      break;
    default:
      speed = 2;
      lifetime = 1000;
  }

  return {
    id: `${Date.now()}-${index}-${Math.random()}`,
    x: origin.x,
    y: origin.y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed - (type === 'sparkle' ? 2 : 0), // sparkles float up
    rotation: Math.random() * 360,
    rotationSpeed: (Math.random() - 0.5) * 10,
    opacity: 1,
    scale: type === 'sparkle' ? 0.5 + Math.random() * 0.5 : 0.8 + Math.random() * 0.4,
    color,
    type,
    lifetime: 0,
    maxLifetime: lifetime,
  };
};

interface ParticleComponentProps {
  particle: Particle;
}

function ParticleComponent({ particle }: ParticleComponentProps) {
  const opacity = useSharedValue(1);
  const translateX = useSharedValue(particle.x);
  const translateY = useSharedValue(particle.y);
  const rotate = useSharedValue(particle.rotation);
  const scale = useSharedValue(particle.scale);

  useEffect(() => {
    const gravity = particle.type === 'confetti' ? 0.15 : particle.type === 'explosion' ? 0.1 : -0.02;

    // Animate to final position
    translateX.value = withTiming(particle.x + particle.vx * 60, {
      duration: particle.maxLifetime,
    });
    translateY.value = withTiming(particle.y + particle.vy * 60 + gravity * 3600, {
      duration: particle.maxLifetime,
    });
    rotate.value = withTiming(particle.rotation + particle.rotationSpeed * 60, {
      duration: particle.maxLifetime,
    });
    opacity.value = withTiming(0, { duration: particle.maxLifetime });
    scale.value = withTiming(particle.type === 'explosion' ? 0 : particle.scale * 0.5, {
      duration: particle.maxLifetime,
    });
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  const getParticleStyle = () => {
    switch (particle.type) {
      case 'sparkle':
        return {
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: particle.color,
        };
      case 'confetti':
        return {
          width: 8,
          height: 12,
          borderRadius: 2,
          backgroundColor: particle.color,
        };
      case 'explosion':
        return {
          width: 10,
          height: 10,
          borderRadius: 5,
          backgroundColor: particle.color,
        };
    }
  };

  return <Animated.View style={[animatedStyle, getParticleStyle()]} />;
}

export function useParticles() {
  const [particles, setParticles] = useState<Particle[]>([]);
  const cleanupTimeouts = useRef<ReturnType<typeof setTimeout>[]>([]);

  const spawnParticles = useCallback(
    (count: number, origin: ParticleOrigin, type: ParticleType) => {
      const newParticles: Particle[] = [];
      for (let i = 0; i < count; i++) {
        newParticles.push(generateParticle(origin, type, i));
      }

      setParticles((prev) => [...prev, ...newParticles]);

      // Schedule cleanup for each particle
      newParticles.forEach((particle) => {
        const timeout = setTimeout(() => {
          setParticles((prev) => prev.filter((p) => p.id !== particle.id));
        }, particle.maxLifetime + 100);
        cleanupTimeouts.current.push(timeout);
      });
    },
    []
  );

  const clearParticles = useCallback(() => {
    setParticles([]);
    cleanupTimeouts.current.forEach(clearTimeout);
    cleanupTimeouts.current = [];
  }, []);

  useEffect(() => {
    return () => {
      cleanupTimeouts.current.forEach(clearTimeout);
    };
  }, []);

  const ParticlesComponent = useCallback(
    () => (
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {particles.map((particle) => (
          <ParticleComponent key={particle.id} particle={particle} />
        ))}
      </View>
    ),
    [particles]
  );

  return {
    spawnParticles,
    clearParticles,
    Particles: ParticlesComponent,
    particleCount: particles.length,
  };
}
