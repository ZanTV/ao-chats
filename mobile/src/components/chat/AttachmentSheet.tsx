import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  Image,
  ScrollView,
  Platform,
  ActivityIndicator,
  PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { BorderRadius, Spacing } from '../../theme';
import { UPLOAD_LIMITS } from '../../attachments/types';
import {
  kindFromMimeClient,
  validatePendingAttachment,
  type PendingAttachment,
} from '../../attachments/pending';

type RecentItem = {
  id: string;
  uri: string;
  mimeType: string;
  fileName: string;
  fileSize: number;
  width?: number;
  height?: number;
  mediaType?: 'photo' | 'video';
  duration?: number;
};

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (file: PendingAttachment) => void;
  onError: (message: string) => void;
  colors: {
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    textTertiary: string;
    border: string;
    primary: string;
    pressHighlight?: string;
  };
  fonts: { sm: number; md: number; xs: number };
  labels: {
    title: string;
    gallery: string;
    document: string;
    link: string;
    recent: string;
    cancel: string;
  };
}

export function AttachmentSheet({
  visible,
  onClose,
  onSelect,
  onError,
  colors,
  fonts,
  labels,
}: Props) {
  const [recent, setRecent] = useState<RecentItem[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const openingGallery = useRef(false);

  const loadRecent = useCallback(async () => {
    if (Platform.OS === 'web') {
      setRecent([]);
      setPermissionDenied(false);
      return;
    }
    setLoadingRecent(true);
    setPermissionDenied(false);
    try {
      const MediaLibrary = await import('expo-media-library/legacy');
      const perm = await MediaLibrary.requestPermissionsAsync();
      if (!perm.granted) {
        setRecent([]);
        setPermissionDenied(true);
        return;
      }
      const page = await MediaLibrary.getAssetsAsync({
        first: UPLOAD_LIMITS.maxRecentMedia,
        mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video],
        sortBy: [[MediaLibrary.SortBy.creationTime, false]],
      });
      const items: RecentItem[] = [];
      for (const a of page.assets) {
        let uri = a.uri;
        // Prefer local URI for reliable thumbnails on some Android devices
        try {
          const info = await MediaLibrary.getAssetInfoAsync(a.id);
          if (info.localUri) uri = info.localUri;
        } catch {
          /* keep asset.uri */
        }
        items.push({
          id: a.id,
          uri,
          mimeType: a.mediaType === 'video' ? 'video/mp4' : 'image/jpeg',
          fileName: a.filename || (a.mediaType === 'video' ? 'video.mp4' : 'photo.jpg'),
          fileSize: 1,
          width: a.width,
          height: a.height,
          mediaType: a.mediaType === 'video' ? 'video' : 'photo',
          duration: typeof a.duration === 'number' ? a.duration : undefined,
        });
      }
      setRecent(items);
    } catch {
      setRecent([]);
    } finally {
      setLoadingRecent(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      openingGallery.current = false;
      loadRecent();
    }
  }, [visible, loadRecent]);

  const emitFile = (file: PendingAttachment) => {
    const err = validatePendingAttachment(file);
    if (err) {
      onError(err);
      return;
    }
    onClose();
    onSelect(file);
  };

  const pickGallery = async () => {
    if (openingGallery.current) return;
    openingGallery.current = true;
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        onError("You don't have permission to upload this file.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        quality: 0.85,
        allowsMultipleSelection: false,
        videoMaxDuration: 120,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const mime = asset.mimeType || (asset.type === 'video' ? 'video/mp4' : 'image/jpeg');
      emitFile({
        localUri: asset.uri,
        mimeType: mime,
        fileName: asset.fileName || (mime.startsWith('video/') ? 'video.mp4' : 'photo.jpg'),
        fileSize: asset.fileSize || 0,
        kind: kindFromMimeClient(mime),
        width: asset.width,
        height: asset.height,
        previewUri: asset.uri,
      });
    } finally {
      openingGallery.current = false;
    }
  };

  const pickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
      type: [
        'application/pdf',
        'text/plain',
        'text/csv',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/zip',
        'application/x-zip-compressed',
      ],
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const mime = asset.mimeType || 'application/octet-stream';
    emitFile({
      localUri: asset.uri,
      mimeType: mime,
      fileName: asset.name || 'document',
      fileSize: asset.size || 0,
      kind: kindFromMimeClient(mime),
      previewUri: undefined,
    });
  };

  const pickRecent = (item: RecentItem) => {
    emitFile({
      localUri: item.uri,
      mimeType: item.mimeType,
      fileName: item.fileName,
      fileSize: item.fileSize || 1,
      kind: kindFromMimeClient(item.mimeType),
      width: item.width,
      height: item.height,
      previewUri: item.uri,
      duration: item.duration,
    });
  };

  const swipeUpToGallery = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => g.dy < -18 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderRelease: (_e, g) => {
        if (g.dy < -48 || g.vy < -0.6) {
          void pickGallery();
        }
      },
    })
  ).current;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: colors.background }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <Text style={[styles.title, { color: colors.text, fontSize: fonts.md }]}>{labels.title}</Text>

          <View style={styles.actions}>
            <ActionTile
              icon="images-outline"
              label={labels.gallery}
              color={colors.primary}
              textColor={colors.text}
              fonts={fonts}
              onPress={pickGallery}
            />
            <ActionTile
              icon="document-text-outline"
              label={labels.document}
              color={colors.primary}
              textColor={colors.text}
              fonts={fonts}
              onPress={pickDocument}
            />
            <ActionTile
              icon="link-outline"
              label={labels.link}
              color={colors.primary}
              textColor={colors.text}
              fonts={fonts}
              onPress={() => {
                onClose();
              }}
            />
          </View>

          <View {...swipeUpToGallery.panHandlers}>
            <View style={styles.recentHeader}>
              <Text style={[styles.recentLabel, { color: colors.textSecondary, fontSize: fonts.sm }]}>
                {labels.recent}
              </Text>
              <Text style={{ color: colors.textTertiary, fontSize: fonts.xs }}>↑ Gallery</Text>
            </View>

            {loadingRecent ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: Spacing.md }} />
            ) : permissionDenied ? (
              <TouchableOpacity
                style={[styles.permissionBox, { borderColor: colors.border }]}
                onPress={loadRecent}
              >
                <Ionicons name="lock-closed-outline" size={18} color={colors.primary} />
                <Text style={{ color: colors.textSecondary, fontSize: fonts.xs, flex: 1 }}>
                  Allow photo access to see recent media
                </Text>
              </TouchableOpacity>
            ) : Platform.OS === 'web' ? (
              <TouchableOpacity
                style={[styles.permissionBox, { borderColor: colors.border }]}
                onPress={pickGallery}
              >
                <Ionicons name="images-outline" size={18} color={colors.primary} />
                <Text style={{ color: colors.textSecondary, fontSize: fonts.xs, flex: 1 }}>
                  Open gallery to choose photos or videos
                </Text>
              </TouchableOpacity>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.recentRow}
              >
                {recent.map((item) => (
                  <TouchableOpacity key={item.id} onPress={() => pickRecent(item)} activeOpacity={0.85}>
                    <Image source={{ uri: item.uri }} style={styles.thumb} />
                    {item.mediaType === 'video' && (
                      <View style={styles.videoBadge}>
                        <Ionicons name="play" size={12} color="#fff" />
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
                {!recent.length && (
                  <Text style={{ color: colors.textTertiary, fontSize: fonts.xs, paddingVertical: Spacing.sm }}>
                    No recent media
                  </Text>
                )}
              </ScrollView>
            )}
          </View>

          <TouchableOpacity
            style={[styles.cancelBtn, { backgroundColor: colors.pressHighlight || colors.border }]}
            onPress={onClose}
          >
            <Text style={{ color: colors.textSecondary, fontWeight: '600', fontSize: fonts.sm }}>
              {labels.cancel}
            </Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ActionTile({
  icon,
  label,
  color,
  textColor,
  fonts,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  textColor: string;
  fonts: { sm: number; xs: number };
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.tile} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.tileIcon, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <Text style={{ color: textColor, fontSize: fonts.xs, fontWeight: '600', textAlign: 'center' }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingBottom: Spacing.lg,
    paddingHorizontal: Spacing.md,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  title: {
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: Spacing.lg,
  },
  tile: {
    alignItems: 'center',
    width: 96,
    gap: 8,
  },
  tileIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  recentLabel: {
    fontWeight: '600',
  },
  recentRow: {
    gap: Spacing.sm,
    paddingBottom: Spacing.md,
    minHeight: 80,
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  videoBadge: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 10,
    padding: 3,
  },
  permissionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  cancelBtn: {
    marginTop: Spacing.sm,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
});
