import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { PendingAttachment } from '../../attachments/pending';
import { formatFileSize } from '../../attachments/types';
import { BorderRadius, Spacing } from '../../theme';

interface Props {
  file: PendingAttachment;
  uploadPercent?: number | null;
  uploading?: boolean;
  failed?: boolean;
  onClear: () => void;
  onCancelUpload?: () => void;
  onRetry?: () => void;
  colors: {
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
    primary: string;
    danger: string;
  };
  fonts: { xs: number; sm: number };
  labels: {
    uploading: string;
    failed: string;
    retry: string;
    cancel: string;
  };
}

export function AttachmentPreviewBar({
  file,
  uploadPercent,
  uploading,
  failed,
  onClear,
  onCancelUpload,
  onRetry,
  colors,
  fonts,
  labels,
}: Props) {
  return (
    <View style={[styles.wrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {file.kind === 'image' || file.kind === 'video' ? (
        <View>
          <Image source={{ uri: file.previewUri || file.localUri }} style={styles.thumb} />
          {file.kind === 'video' && (
            <View style={styles.playBadge}>
              <Ionicons name="play" size={12} color="#fff" />
            </View>
          )}
        </View>
      ) : (
        <View style={[styles.docIcon, { backgroundColor: colors.primary + '18' }]}>
          <Ionicons name="document-text-outline" size={20} color={colors.primary} />
        </View>
      )}

      <View style={styles.meta}>
        <Text style={{ color: colors.text, fontSize: fonts.sm, fontWeight: '600' }} numberOfLines={1}>
          {file.fileName}
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: fonts.xs }}>
          {formatFileSize(file.fileSize)}
          {file.kind === 'document' ? ` · ${file.mimeType.split('/').pop()?.toUpperCase()}` : ''}
        </Text>
        {uploading && (
          <View style={styles.progressRow}>
            <View style={[styles.track, { backgroundColor: colors.border }]}>
              <View
                style={[
                  styles.fill,
                  {
                    width: `${Math.max(0, Math.min(100, uploadPercent ?? 0))}%`,
                    backgroundColor: colors.primary,
                  },
                ]}
              />
            </View>
            <Text style={{ color: colors.textSecondary, fontSize: fonts.xs }}>
              {labels.uploading} {Math.round(uploadPercent ?? 0)}%
            </Text>
          </View>
        )}
        {failed && (
          <TouchableOpacity onPress={onRetry}>
            <Text style={{ color: colors.danger, fontSize: fonts.xs, marginTop: 2 }}>
              {labels.failed} · {labels.retry}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {uploading ? (
        <TouchableOpacity onPress={onCancelUpload} hitSlop={8}>
          <ActivityIndicator size="small" color={colors.primary} />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity onPress={onClear} hitSlop={8}>
          <Ionicons name="close-circle" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  thumb: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.md,
  },
  playBadge: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 8,
    padding: 2,
  },
  docIcon: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: {
    flex: 1,
  },
  progressRow: {
    marginTop: 4,
    gap: 4,
  },
  track: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
});
