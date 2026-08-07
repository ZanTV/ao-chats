import React from 'react';
import { View, Image, StyleSheet, Text, Platform } from 'react-native';
import { Spacing } from '../theme';

const appIcon = require('../../assets/icon.png');

interface Props {
  size?: number;
  showTitle?: boolean;
  title?: string;
  tagline?: string;
  titleColor?: string;
  taglineColor?: string;
  titleSize?: number;
  taglineSize?: number;
}

export function AppLogo({
  size = 96,
  showTitle = true,
  title = 'AO Chats',
  tagline,
  titleColor = '#1F2937',
  taglineColor = '#6B7280',
  titleSize = 32,
  taglineSize = 16,
}: Props) {
  return (
    <View style={styles.wrap}>
      <View style={[styles.iconShadow, { width: size, height: size, borderRadius: size * 0.22 }]}>
        <Image
          source={appIcon}
          style={{ width: size, height: size, borderRadius: size * 0.22 }}
          resizeMode="cover"
          accessibilityLabel="AO Chats logo"
        />
      </View>
      {showTitle && (
        <Text style={[styles.title, { color: titleColor, fontSize: titleSize }]}>{title}</Text>
      )}
      {tagline ? (
        <Text style={[styles.tagline, { color: taglineColor, fontSize: taglineSize }]}>{tagline}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  iconShadow: {
    marginBottom: Spacing.md,
    ...Platform.select({
      ios: {
        shadowColor: '#2563EB',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.18,
        shadowRadius: 16,
      },
      android: { elevation: 8 },
      default: {},
    }),
  },
  title: { fontWeight: '700', marginBottom: Spacing.xs, textAlign: 'center' },
  tagline: { textAlign: 'center', lineHeight: 22 },
});
