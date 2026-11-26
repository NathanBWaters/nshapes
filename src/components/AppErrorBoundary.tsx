import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform, ScrollView } from 'react-native';
import { COLORS, RADIUS } from '@/utils/colors';
import { MONO_FONT } from '@/utils/fonts';

interface State {
  hasError: boolean;
  errorMessage: string;
  copied: boolean;
}

interface Props {
  children: React.ReactNode;
}

/**
 * Top-level crash boundary so unexpected render errors show a graceful recovery
 * screen instead of a blank screen or silent native exit.
 */
export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = {
    hasError: false,
    errorMessage: '',
    copied: false,
  };

  static getDerivedStateFromError(error: unknown): Partial<State> {
    const message =
      error instanceof Error
        ? `${error.name}: ${error.message}`
        : String(error ?? 'Unknown error');
    return {
      hasError: true,
      errorMessage: message,
      copied: false,
    };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo): void {
    // Kept concise so Apple Crash Logs / Play Vitals / console capture root cause cleanly
    console.error('[AppErrorBoundary]', error, info?.componentStack);
  }

  private handleReset = () => {
    this.setState({ hasError: false, errorMessage: '', copied: false });
  };

  private handleReload = async () => {
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
        window.location.reload();
        return;
      }
      const Updates = await import('expo-updates');
      if (Updates && typeof Updates.reloadAsync === 'function') {
        await Updates.reloadAsync();
        return;
      }
    } catch {
      // Fallback to clearing boundary state if expo-updates isn't active (e.g. dev/tests)
    }
    this.handleReset();
  };

  private handleCopy = async () => {
    const details = this.state.errorMessage || 'Unknown error';
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(details);
      } else {
        const Clipboard = await import('expo-clipboard');
        if (Clipboard?.setStringAsync) {
          await Clipboard.setStringAsync(details);
        }
      }
      this.setState({ copied: true });
    } catch {
      /* ignore clipboard errors */
    }
  };

  render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <View style={styles.root} testID="app-error-boundary">
        <View style={styles.card}>
          <Text style={styles.eyebrow}>NSHAPES</Text>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.body}>
            Your saved progress is safe on your device. Tap below to restart the screen cleanly.
          </Text>
          {Boolean(this.state.errorMessage) && (
            <ScrollView style={styles.errorBox} contentContainerStyle={styles.errorBoxContent}>
              <Text style={styles.errorText} selectable>
                {this.state.errorMessage}
              </Text>
            </ScrollView>
          )}
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              testID="error-boundary-retry"
              onPress={this.handleReset}
              style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
            >
              <Text style={styles.primaryBtnText}>RETURN TO GAME</Text>
            </Pressable>
            <View style={styles.secondaryRow}>
              <Pressable
                accessibilityRole="button"
                testID="error-boundary-reload"
                onPress={() => void this.handleReload()}
                style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
              >
                <Text style={styles.secondaryBtnText}>RELOAD APP</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                testID="error-boundary-copy"
                onPress={() => void this.handleCopy()}
                style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
              >
                <Text style={styles.secondaryBtnText}>
                  {this.state.copied ? 'COPIED ✓' : 'COPY DETAILS'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.paperBeige,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: COLORS.canvasWhite,
    borderRadius: RADIUS.module,
    borderWidth: 2,
    borderColor: COLORS.slateCharcoal,
    padding: 22,
    gap: 12,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: COLORS.logicTeal,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.deepOnyx,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.slateCharcoal,
  },
  errorBox: {
    maxHeight: 110,
    backgroundColor: COLORS.paperBeige,
    borderRadius: RADIUS.button,
    borderWidth: 1,
    borderColor: '#D6D0C4',
  },
  errorBoxContent: {
    padding: 10,
  },
  errorText: {
    fontSize: 11,
    fontFamily: MONO_FONT,
    color: COLORS.slateCharcoal,
  },
  actions: {
    gap: 10,
    marginTop: 4,
  },
  primaryBtn: {
    backgroundColor: COLORS.actionYellow,
    borderRadius: RADIUS.button,
    borderWidth: 2,
    borderColor: COLORS.slateCharcoal,
    paddingVertical: 13,
    alignItems: 'center',
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.deepOnyx,
    letterSpacing: 0.6,
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryBtn: {
    flex: 1,
    backgroundColor: COLORS.paperBeige,
    borderRadius: RADIUS.button,
    borderWidth: 1.5,
    borderColor: COLORS.slateCharcoal,
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.slateCharcoal,
    letterSpacing: 0.4,
  },
  pressed: {
    opacity: 0.85,
  },
});

export default AppErrorBoundary;
