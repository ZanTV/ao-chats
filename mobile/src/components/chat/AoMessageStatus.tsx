import React from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AoDisplayStatus } from '../../utils/messageStatus';

interface Props {
  status: AoDisplayStatus;
  color?: string;
  readColor?: string;
  size?: number;
}

/** AO Paper Plane — sending */
function AoPaperPlane({ color, size }: { color: string; size: number }) {
  return <Ionicons name="paper-plane" size={size} color={color} style={{ opacity: 0.85 }} />;
}

/** AO Circle — sent to server */
function AoCircle({ color, size }: { color: string; size: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 1.5,
        borderColor: color,
        opacity: 0.9,
      }}
    />
  );
}

/** AO Moon — waiting for offline recipient */
function AoMoon({ color, size }: { color: string; size: number }) {
  return <Ionicons name="moon" size={size} color={color} style={{ opacity: 0.9 }} />;
}

/** AO Pulse — delivered */
function AoPulse({ color, size }: { color: string; size: number }) {
  return (
    <View style={styles.pulseWrap}>
      <View style={[styles.pulseDot, { width: size * 0.35, height: size * 0.35, backgroundColor: color }]} />
      <View style={[styles.pulseRing, { width: size, height: size, borderColor: color + '88' }]} />
    </View>
  );
}

/** AO Eye — read */
function AoEye({ color, size }: { color: string; size: number }) {
  return <Ionicons name="eye" size={size} color={color} />;
}

export function AoMessageStatus({ status, color = 'rgba(255,255,255,0.75)', readColor = '#60A5FA', size = 14 }: Props) {
  if (status === 'sending') {
    return <ActivityIndicator size={size - 2} color={color} />;
  }
  if (status === 'failed') {
    return <Ionicons name="alert-circle" size={size} color="#F87171" />;
  }
  if (status === 'sent') return <AoCircle color={color} size={size} />;
  if (status === 'waiting') return <AoMoon color={color} size={size} />;
  if (status === 'delivered') return <AoPulse color={color} size={size} />;
  if (status === 'read') return <AoEye color={readColor} size={size} />;
  return null;
}

const styles = StyleSheet.create({
  pulseWrap: { alignItems: 'center', justifyContent: 'center', width: 14, height: 14 },
  pulseDot: { borderRadius: 99, position: 'absolute' },
  pulseRing: { borderRadius: 99, borderWidth: 1.5, position: 'absolute' },
});
