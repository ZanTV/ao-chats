import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AvatarColors, AvatarEmojis, BorderRadius } from '../theme';

interface AvatarProps {
  avatarId: string;
  size?: number;
  showOnline?: boolean;
  isOnline?: boolean;
  isVerified?: boolean;
  style?: ViewStyle;
}

export function Avatar({
  avatarId,
  size = 48,
  showOnline,
  isOnline,
  isVerified,
  style,
}: AvatarProps) {
  const color = AvatarColors[avatarId] || AvatarColors['avatar-30'];
  const emoji = AvatarEmojis[avatarId] || '💠';

  return (
    <View style={[{ width: size, height: size }, style]}>
      <View
        style={[
          styles.avatar,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color + '20',
          },
        ]}
      >
        <Text style={{ fontSize: size * 0.45 }}>{emoji}</Text>
      </View>
      {showOnline && (
        <View
          style={[
            styles.onlineIndicator,
            {
              width: size * 0.28,
              height: size * 0.28,
              borderRadius: size * 0.14,
              backgroundColor: isOnline ? '#10B981' : '#9CA3AF',
              right: 0,
              bottom: 0,
            },
          ]}
        />
      )}
      {isVerified && (
        <View
          style={[
            styles.verifiedBadge,
            {
              width: size * 0.32,
              height: size * 0.32,
              borderRadius: size * 0.16,
              right: -2,
              top: -2,
            },
          ]}
        >
          <Ionicons name="checkmark-circle" size={size * 0.32} color="#3B82F6" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineIndicator: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  verifiedBadge: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.full,
  },
});
