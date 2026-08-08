import React, { forwardRef, useCallback, useEffect, useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  type TextInput as TextInputType,
  type NativeSyntheticEvent,
  type TextInputContentSizeChangeEventData,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ComposerLayout } from '../../theme/composer';
import { Spacing } from '../../theme';

export interface ChatComposerFieldColors {
  text: string;
  textSecondary: string;
  textTertiary: string;
  primary: string;
  border: string;
  inputBackground: string;
  inputBorder: string;
  surface: string;
}

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  emojiOpen: boolean;
  canSubmit: boolean;
  submitMode?: 'send' | 'save';
  onEmojiPress: () => void;
  onSubmit: () => void;
  onFocus?: () => void;
  onContentHeightChange?: (height: number) => void;
  colors: ChatComposerFieldColors;
  fonts: { md: number };
  emojiAccessibilityLabel: string;
  sendAccessibilityLabel: string;
  inputAccessibilityLabel?: string;
  maxLength?: number;
}

export const ChatComposerField = forwardRef<TextInputType, Props>(function ChatComposerField(
  {
    value,
    onChangeText,
    placeholder,
    emojiOpen,
    canSubmit,
    submitMode = 'send',
    onEmojiPress,
    onSubmit,
    onFocus,
    onContentHeightChange,
    colors,
    fonts,
    emojiAccessibilityLabel,
    sendAccessibilityLabel,
    inputAccessibilityLabel,
    maxLength = 5000,
  },
  ref
) {
  const [focused, setFocused] = useState(false);
  const [inputHeight, setInputHeight] = useState(ComposerLayout.minHeight);

  useEffect(() => {
    if (!value) {
      setInputHeight(ComposerLayout.minHeight);
    }
  }, [value]);

  const handleContentSizeChange = useCallback(
    (e: NativeSyntheticEvent<TextInputContentSizeChangeEventData>) => {
      const raw = e.nativeEvent.contentSize.height;
      const next = Math.min(
        ComposerLayout.maxHeight,
        Math.max(ComposerLayout.minHeight, Math.ceil(raw))
      );
      setInputHeight((prev) => (prev === next ? prev : next));
      onContentHeightChange?.(next);
    },
    [onContentHeightChange]
  );

  return (
    <View
      style={[
        styles.field,
        {
          backgroundColor: colors.inputBackground,
          borderColor: focused || emojiOpen ? colors.primary : colors.inputBorder,
        },
      ]}
    >
      <TouchableOpacity
        style={styles.control}
        onPress={onEmojiPress}
        accessibilityLabel={emojiAccessibilityLabel}
        accessibilityRole="button"
        hitSlop={4}
      >
        <Ionicons
          name={emojiOpen ? 'keypad-outline' : 'happy-outline'}
          size={ComposerLayout.iconSize}
          color={emojiOpen || focused ? colors.primary : colors.textSecondary}
        />
      </TouchableOpacity>

      <TextInput
        ref={ref}
        style={[
          styles.input,
          {
            color: colors.text,
            fontSize: fonts.md,
            height: inputHeight,
            lineHeight: fonts.md + 6,
            ...(Platform.OS === 'web'
              ? ({ outlineStyle: 'none', resize: 'none' } as object)
              : null),
          },
        ]}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        value={value}
        onChangeText={onChangeText}
        multiline
        maxLength={maxLength}
        blurOnSubmit={false}
        textAlignVertical="top"
        scrollEnabled={inputHeight >= ComposerLayout.maxHeight}
        onContentSizeChange={handleContentSizeChange}
        onFocus={() => {
          setFocused(true);
          onFocus?.();
        }}
        onBlur={() => setFocused(false)}
        accessibilityLabel={inputAccessibilityLabel || placeholder}
        underlineColorAndroid="transparent"
      />

      <TouchableOpacity
        style={[
          styles.send,
          {
            backgroundColor: canSubmit ? colors.primary : 'transparent',
            opacity: canSubmit ? 1 : 0.55,
          },
        ]}
        onPress={onSubmit}
        disabled={!canSubmit}
        accessibilityLabel={sendAccessibilityLabel}
        accessibilityRole="button"
        hitSlop={4}
      >
        <Ionicons
          name={submitMode === 'save' ? 'checkmark' : 'send'}
          size={ComposerLayout.sendIconSize}
          color={canSubmit ? '#FFFFFF' : colors.textTertiary}
          style={submitMode === 'send' ? { marginLeft: 2 } : undefined}
        />
      </TouchableOpacity>
    </View>
  );
});

const styles = StyleSheet.create({
  field: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    minHeight: ComposerLayout.rowMinHeight,
    borderRadius: ComposerLayout.fieldRadius,
    borderWidth: StyleSheet.hairlineWidth + 0.5,
    paddingHorizontal: ComposerLayout.fieldPaddingH,
    paddingVertical: ComposerLayout.fieldPaddingV,
    gap: ComposerLayout.gap,
  },
  control: {
    width: ComposerLayout.controlSize,
    height: ComposerLayout.controlSize,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: ComposerLayout.controlSize / 2,
  },
  input: {
    flex: 1,
    paddingVertical: Platform.OS === 'ios' ? 8 : 4,
    paddingHorizontal: Spacing.xs,
    margin: 0,
    includeFontPadding: false,
  },
  send: {
    width: ComposerLayout.controlSize,
    height: ComposerLayout.controlSize,
    borderRadius: ComposerLayout.controlSize / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
