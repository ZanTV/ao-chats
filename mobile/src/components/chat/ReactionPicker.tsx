/**
 * Backward-compatible reaction entry — delegates to AOEmojiPicker.
 * Do not add a second emoji system here.
 */
import React from 'react';
import { AOEmojiPicker, type AOEmojiPickerColors } from '../emoji/AOEmojiPicker';
import type { AoEmojiItem } from '../../emoji';

interface Props {
  visible: boolean;
  title: string;
  currentEmoji?: string;
  onSelect: (emoji: string) => void;
  onClose: () => void;
  colors: AOEmojiPickerColors;
  fonts: { xs: number; sm: number; md: number };
  searchPlaceholder?: string;
  emptyLabel?: string;
  recentLabel?: string;
}

export function ReactionPicker({
  visible,
  title,
  currentEmoji,
  onSelect,
  onClose,
  colors,
  fonts,
  searchPlaceholder,
  emptyLabel,
  recentLabel,
}: Props) {
  return (
    <AOEmojiPicker
      visible={visible}
      presentation="sheet"
      title={title}
      currentEmoji={currentEmoji}
      closeOnSelect
      searchPlaceholder={searchPlaceholder}
      emptyLabel={emptyLabel}
      recentLabel={recentLabel}
      onSelect={(emoji: string, _item: AoEmojiItem) => onSelect(emoji)}
      onClose={onClose}
      colors={colors}
      fonts={fonts}
    />
  );
}
