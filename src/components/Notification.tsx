import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

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
  duration = 3000
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [message, duration, onClose]);

  const getTypeStyles = () => {
    switch (type) {
      case 'success':
        return 'bg-green-100 border-l-4 border-green-500';
      case 'error':
        return 'bg-red-100 border-l-4 border-red-500';
      case 'warning':
        return 'bg-yellow-100 border-l-4 border-yellow-500';
      case 'info':
      default:
        return 'bg-blue-100 border-l-4 border-blue-500';
    }
  };

  const getTextColor = () => {
    switch (type) {
      case 'success':
        return 'text-green-700';
      case 'error':
        return 'text-red-700';
      case 'warning':
        return 'text-yellow-700';
      case 'info':
      default:
        return 'text-blue-700';
    }
  };

  return (
    <View className="absolute top-4 right-4 left-4 z-50">
      <View className={`flex-row items-center p-4 rounded shadow-md ${getTypeStyles()}`}>
        <View className="flex-1">
          <Text className={getTextColor()}>{message}</Text>
        </View>
        <TouchableOpacity
          onPress={onClose}
          className="ml-4 p-1"
        >
          <Text className="text-gray-500 text-lg">✕</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default Notification;
