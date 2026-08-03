import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSettingsStore } from '../stores/settingsStore';
import { Spacing } from '../theme';

interface ProgressBarProps {
  currentStep: number;
  totalSteps: number;
}

export function ProgressBar({ currentStep, totalSteps }: ProgressBarProps) {
  const colors = useSettingsStore((s) => s.colors);
  const t = useSettingsStore((s) => s.t);

  return (
    <View style={styles.container}>
      <Text style={[styles.stepText, { color: colors.textSecondary }]}>
        {t.auth.step} {currentStep} {t.auth.of} {totalSteps}
      </Text>
      <View style={[styles.track, { backgroundColor: colors.borderLight }]}>
        <View
          style={[
            styles.fill,
            {
              backgroundColor: colors.primary,
              width: `${(currentStep / totalSteps) * 100}%`,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: Spacing.lg },
  stepText: { fontSize: 13, marginBottom: Spacing.sm, fontWeight: '500' },
  track: { height: 4, borderRadius: 2, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 2 },
});
