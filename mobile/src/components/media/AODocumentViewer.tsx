import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  Linking,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatFileSize, type MessageAttachment } from '../../attachments/types';
import { BorderRadius, Spacing } from '../../theme';

interface Props {
  attachment: MessageAttachment;
  localUri: string | null;
  loading?: boolean;
  progress?: number;
  error?: string | null;
  onRetry?: () => void;
  onOpenExternal?: () => void;
  senderName?: string;
  colors: {
    text: string;
    textSecondary: string;
    primary: string;
    surface: string;
    border: string;
  };
  fonts: { xs: number; sm: number; md: number };
  labels: {
    opening: string;
    openWith: string;
    retry: string;
    sender: string;
  };
}

export function AODocumentViewer({
  attachment,
  localUri,
  loading,
  progress,
  error,
  onRetry,
  onOpenExternal,
  senderName,
  colors,
  fonts,
  labels,
}: Props) {
  const isPdf = useMemo(
    () =>
      attachment.mimeType === 'application/pdf' ||
      attachment.fileName.toLowerCase().endsWith('.pdf'),
    [attachment]
  );

  const openExternal = async () => {
    if (onOpenExternal) {
      onOpenExternal();
      return;
    }
    if (!localUri) return;
    if (Platform.OS === 'web') {
      window.open(localUri, '_blank');
      return;
    }
    await Linking.openURL(localUri).catch(() => {});
  };

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.icon, { backgroundColor: colors.primary + '18' }]}>
          <Ionicons name="document-text-outline" size={36} color={colors.primary} />
        </View>
        <Text style={{ color: colors.text, fontSize: fonts.md, fontWeight: '700', textAlign: 'center' }}>
          {attachment.fileName}
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: fonts.sm, marginTop: 6 }}>
          {attachment.mimeType.split('/').pop()?.toUpperCase()} · {formatFileSize(attachment.fileSize)}
        </Text>
        {!!senderName && (
          <Text style={{ color: colors.textSecondary, fontSize: fonts.xs, marginTop: 10 }}>
            {labels.sender}: {senderName}
          </Text>
        )}

        {loading && (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
            <Text style={{ color: colors.textSecondary, marginTop: 8, fontSize: fonts.sm }}>
              {labels.opening}
              {typeof progress === 'number' ? ` ${Math.round(progress * 100)}%` : ''}
            </Text>
          </View>
        )}

        {!!error && (
          <TouchableOpacity onPress={onRetry} style={{ marginTop: Spacing.md }}>
            <Text style={{ color: colors.primary, fontWeight: '600' }}>
              {error} · {labels.retry}
            </Text>
          </TouchableOpacity>
        )}

        {!loading && !error && localUri && (
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: colors.primary }]}
            onPress={openExternal}
          >
            <Ionicons name={isPdf ? 'eye-outline' : 'open-outline'} size={18} color="#fff" />
            <Text style={styles.btnText}>{labels.openWith}</Text>
          </TouchableOpacity>
        )}

        {Platform.OS === 'web' && isPdf && localUri && !loading && !error && (
          <View style={styles.pdfFrame}>
            {/* eslint-disable-next-line react/no-unknown-property */}
            <iframe
              src={localUri}
              title={attachment.fileName}
              style={{ width: '100%', height: 480, border: 'none', borderRadius: 12 }}
            />
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexGrow: 1,
    padding: Spacing.lg,
    justifyContent: 'center',
  },
  card: {
    borderRadius: BorderRadius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.lg,
    alignItems: 'center',
  },
  icon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  loading: {
    marginTop: Spacing.lg,
    alignItems: 'center',
  },
  btn: {
    marginTop: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: BorderRadius.lg,
  },
  btnText: { color: '#fff', fontWeight: '700' },
  pdfFrame: {
    width: '100%',
    marginTop: Spacing.lg,
    overflow: 'hidden',
    borderRadius: BorderRadius.lg,
  },
});
