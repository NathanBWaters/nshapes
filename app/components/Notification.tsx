import React, { useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';

interface NotificationProps {
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  onClose: () => void;
}

const Notification: React.FC<NotificationProps> = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 3000);

    return () => clearTimeout(timer);
  }, [onClose]);

  const getBackgroundColor = () => {
    switch (type) {
      case 'success':
        return 'bg-green-500';
      case 'error':
        return 'bg-red-500';
      case 'warning':
        return 'bg-yellow-500';
      case 'info':
      default:
        return 'bg-blue-500';
    }
  };

  return (
    <View className={`absolute top-4 left-4 right-4 z-50 ${getBackgroundColor()} rounded-lg p-4`}>
      <View className="flex-row justify-between items-center">
        <Text className="text-white flex-1 mr-2">{message}</Text>
        <Pressable onPress={onClose}>
          <Text className="text-white text-xl">×</Text>
        </Pressable>
      </View>
    </View>
  );
};

export default Notification;
