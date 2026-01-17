import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { COLORS, RADIUS } from '@/utils/colors';

interface NotificationProps {
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  onClose: () => void;
  duration?: number;
}

const Notification: React.FC<NotificationProps> = ({
  message,
  type,
  onClose,
  duration = 500
}) => {
  const opacity = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fade in
    Animated.timing(opacity, {
      toValue: 1,
      duration: 150,
      useNativeDriver: true,
    }).start();

    // Auto close after duration
    const timer = setTimeout(() => {
      // Fade out
      Animated.timing(opacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start(() => {
        onClose();
      });
    }, duration);

    return () => clearTimeout(timer);
  }, [message, duration, onClose, opacity]);

  const getTypeStyles = () => {
    switch (type) {
      case 'success':
        return styles.success;
      case 'error':
        return styles.error;
      case 'warning':
        return styles.warning;
      case 'info':
      default:
        return styles.info;
    }
  };

  return (
    <Animated.View style={[styles.container, getTypeStyles(), { opacity }]}>
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: RADIUS.button,
    zIndex: 100,
    maxWidth: 220,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
    shadowColor: COLORS.deepOnyx,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 0,
    elevation: 4,
  },
  text: {
    color: COLORS.canvasWhite,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  success: {
    backgroundColor: COLORS.logicTeal,
  },
  error: {
    backgroundColor: COLORS.impactRed,
  },
  warning: {
    backgroundColor: COLORS.impactOrange,
  },
  info: {
    backgroundColor: COLORS.slateCharcoal,
  },
});

export default Notification;
