import { RuleTester } from 'eslint';
import * as tsParser from '@typescript-eslint/parser';

const plugin = require('../scripts/eslint-plugin-nshapes-perf');

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 'latest',
    sourceType: 'module',
    parserOptions: {
      ecmaFeatures: { jsx: true },
    },
  },
});

describe('eslint-plugin-nshapes-perf', () => {
  ruleTester.run('require-guarded-frame-callback', plugin.rules['require-guarded-frame-callback'], {
    valid: [
      {
        filename: 'src/components/creatures/Creature.tsx',
        code: `
          import { useGuardedFrameCallback } from '@/hooks/useGuardedFrameCallback';
          export function Creature({ animate }: { animate: boolean }) {
            useGuardedFrameCallback((fi) => { 'worklet'; return fi; }, animate, 'Creature');
            return null;
          }
        `,
      },
      {
        // The gateway itself is allowed to import and call raw useFrameCallback
        filename: 'src/hooks/useGuardedFrameCallback.ts',
        code: `
          import { useFrameCallback } from 'react-native-reanimated';
          export function useGuardedFrameCallback(cb: any, active: boolean) {
            return useFrameCallback(cb, active);
          }
        `,
      },
    ],
    invalid: [
      {
        filename: 'src/components/BadImport.tsx',
        code: `import { useFrameCallback } from 'react-native-reanimated';`,
        errors: [{ messageId: 'noRawImport' }],
      },
      {
        filename: 'src/components/BadCall.tsx',
        code: `useFrameCallback(() => {});`,
        errors: [{ messageId: 'noRawCall' }],
      },
      {
        filename: 'src/components/MissingWorklet.tsx',
        code: `useGuardedFrameCallback((fi) => { fi.timestamp; }, active, 'Test');`,
        errors: [{ messageId: 'missingWorklet' }],
      },
      {
        filename: 'src/components/AlwaysTrue.tsx',
        code: `useGuardedFrameCallback((fi) => { 'worklet'; fi.timestamp; }, true, 'Test');`,
        errors: [{ messageId: 'noAlwaysTrue' }],
      },
      {
        filename: 'src/components/MissingLabel.tsx',
        code: `useGuardedFrameCallback((fi) => { 'worklet'; fi.timestamp; }, active, '');`,
        errors: [{ messageId: 'missingLabel' }],
      },
    ],
  });

  ruleTester.run('no-frame-loop-allocations', plugin.rules['no-frame-loop-allocations'], {
    valid: [
      {
        filename: 'src/components/GoodMotion.tsx',
        code: `
          const step = (cur: any) => { 'worklet'; cur.x += 1; };
          useGuardedFrameCallback((fi) => {
            'worklet';
            sim.modify(step);
          }, active, 'GoodMotion');
          const style = useAnimatedStyle(() => ({
            opacity: 1,
            transform: [{ translateX: val.value }],
          }));
        `,
      },
    ],
    invalid: [
      {
        filename: 'src/components/SpreadMotion.tsx',
        code: `
          useGuardedFrameCallback((fi) => {
            'worklet';
            sim.value = { ...sim.value, x: 1 };
          }, active, 'SpreadMotion');
        `,
        errors: [{ messageId: 'noSpread' }],
      },
      {
        filename: 'src/components/NewInStyle.tsx',
        code: `
          const style = useAnimatedStyle(() => {
            const map = new Map();
            return { opacity: map.size };
          });
        `,
        errors: [{ messageId: 'noNew' }],
      },
      {
        filename: 'src/components/MapInDerived.tsx',
        code: `
          const derived = useDerivedValue(() => {
            return [1, 2].map((x) => x * 2);
          });
        `,
        errors: [{ messageId: 'noAllocCall' }],
      },
    ],
  });

  ruleTester.run('require-safe-infinite-animation', plugin.rules['require-safe-infinite-animation'], {
    valid: [
      {
        filename: 'src/components/SafeBob.tsx',
        code: `
          export function SafeBob() {
            const appActive = useAppActive();
            useEffect(() => {
              if (!appActive) { cancelAnimation(y); return; }
              y.value = withRepeat(withTiming(4), -1, true);
              return () => cancelAnimation(y);
            }, [appActive, y]);
            const s = useAnimatedStyle(() => ({ opacity: y.value, transform: [{ translateY: y.value }] }));
            return s;
          }
        `,
      },
    ],
    invalid: [
      {
        filename: 'src/components/NoCleanup.tsx',
        code: `
          export function NoCleanup() {
            const appActive = useAppActive();
            useEffect(() => {
              if (appActive) y.value = withRepeat(withTiming(4), -1);
            }, [appActive, y]);
            return null;
          }
        `,
        errors: [{ messageId: 'missingCleanupAndGate' }],
      },
      {
        filename: 'src/components/NoGate.tsx',
        code: `
          export function NoGate() {
            useEffect(() => {
              y.value = withRepeat(withTiming(4), -1);
              return () => cancelAnimation(y);
            }, [y]);
            return null;
          }
        `,
        errors: [{ messageId: 'missingCleanupAndGate' }],
      },
      {
        filename: 'src/components/BadBgPulse.tsx',
        code: `
          export function BadBgPulse() {
            const appActive = useAppActive();
            useEffect(() => {
              if (!appActive) return;
              y.value = withRepeat(withTiming(1), -1);
              return () => cancelAnimation(y);
            }, [appActive, y]);
            const s = useAnimatedStyle(() => ({
              backgroundColor: interpolateColor(y.value, [0, 1], ['#000', '#fff']),
            }));
            return s;
          }
        `,
        errors: [{ messageId: 'nonCompositedStyle' }, { messageId: 'noInterpolateColor' }],
      },
    ],
  });

  ruleTester.run(
    'single-lifecycle-and-audio-gateway',
    plugin.rules['single-lifecycle-and-audio-gateway'],
    {
      valid: [
        {
          filename: 'src/audio/chip.ts',
          code: `export const ctx = new AudioContext();`,
        },
        {
          filename: 'src/utils/appLifecycle.ts',
          code: `
            AppState.addEventListener('change', () => {});
            document.addEventListener('visibilitychange', () => {});
            window.addEventListener('pagehide', () => {});
          `,
        },
        {
          filename: 'src/audio/index.ts',
          code: `export const off = new OfflineAudioContext(1, 100, 22050);`,
        },
        {
          filename: 'src/components/Counter.tsx',
          code: `
            const id = requestAnimationFrame(() => {});
            cancelAnimationFrame(id);
          `,
        },
      ],
      invalid: [
        {
          filename: 'src/components/RogueAudio.tsx',
          code: `export const ctx = new AudioContext();`,
          errors: [{ messageId: 'audioGateway' }],
        },
        {
          filename: 'src/components/RogueAppState.tsx',
          code: `AppState.addEventListener('change', () => {});`,
          errors: [{ messageId: 'lifecycleGateway' }],
        },
        {
          filename: 'src/components/RogueVisibility.tsx',
          code: `document.addEventListener('visibilitychange', () => {});`,
          errors: [{ messageId: 'lifecycleGateway' }],
        },
        {
          filename: 'src/components/LeakedRaf.tsx',
          code: `requestAnimationFrame(() => {});`,
          errors: [{ messageId: 'rafNeedsCancel' }],
        },
      ],
    }
  );
});
