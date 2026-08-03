import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInputProps,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettingsStore } from '../stores/settingsStore';
import { BorderRadius, Spacing } from '../theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  isPassword?: boolean;
}

export function Input({ label, error, icon, isPassword, style, ...props }: InputProps) {
  const colors = useSettingsStore((s) => s.colors);
  const fonts = useSettingsStore((s) => s.fonts);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <View style={styles.container}>
      {label && (
        <Text style={[styles.label, { color: colors.textSecondary, fontSize: fonts.sm }]}>
          {label}
        </Text>
      )}
      <View
        style={[
          styles.inputWrapper,
          {
            backgroundColor: colors.inputBackground,
            borderColor: error ? colors.danger : colors.border,
          },
        ]}
      >
        {icon && (
          <Ionicons name={icon} size={20} color={colors.textTertiary} style={styles.icon} />
        )}
        <TextInput
          style={[
            styles.input,
            { color: colors.text, fontSize: fonts.md },
            icon ? { paddingLeft: 0 } : {},
            style,
          ]}
          placeholderTextColor={colors.textTertiary}
          secureTextEntry={isPassword && !showPassword}
          {...props}
        />
        {isPassword && (
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={colors.textTertiary}
            />
          </TouchableOpacity>
        )}
      </View>
      {error && (
        <Text style={[styles.error, { color: colors.danger, fontSize: fonts.xs }]}>{error}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: Spacing.md },
  label: { marginBottom: Spacing.xs, fontWeight: '500' },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    minHeight: 52,
  },
  icon: { marginRight: Spacing.sm },
  input: { flex: 1, paddingVertical: Spacing.md - 2 },
  error: { marginTop: Spacing.xs },
});
