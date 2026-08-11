import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ViewStyle,
  Image,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AvatarColors, AvatarEmojis, BorderRadius } from '../theme';
import { getAccessToken } from '../services/storage';
import { resolveAvatarDisplayUrl } from '../utils/avatarUrl';
import { useResolvedAvatar } from '../profile/useResolvedAvatar';

interface AvatarProps {
  avatarId: string;
  /** When set, Avatar listens to realtime avatar sync for this user. */
  userId?: string | null;
  /** Custom profile photo URL (authenticated). Falls back to AO emoji avatar when missing/broken. */
  imageUrl?: string | null;
  imageVersion?: number | null;
  size?: number;
  showOnline?: boolean;
  isOnline?: boolean;
  isVerified?: boolean;
  style?: ViewStyle;
}

const FADE_MS = 200;

function isLocalUri(url: string): boolean {
  return (
    url.startsWith('file:') ||
    url.startsWith('content:') ||
    url.startsWith('blob:') ||
    url.startsWith('data:') ||
    url.startsWith('ph://') ||
    url.startsWith('assets-library:')
  );
}

/**
 * Primary avatar rendering boundary.
 * Precedence (via resolveAvatar): REAL PHOTO > AO avatarId > default.
 * Realtime sync is version-gated so stale props cannot override a newer photo.
 */
export function Avatar({
  avatarId,
  userId,
  imageUrl,
  imageVersion,
  size = 48,
  showOnline,
  isOnline,
  isVerified,
  style,
}: AvatarProps) {
  const resolved = useResolvedAvatar({
    userId,
    avatarId,
    avatarUrl: imageUrl,
    avatarVersion: imageVersion,
  });

  const renderAvatarId = resolved.avatarId;
  const color = AvatarColors[renderAvatarId] || AvatarColors['avatar-30'];
  const emoji = AvatarEmojis[renderAvatarId] || '💠';

  const effectiveUrl = resolved.avatarUrl;
  const effectiveVersion = resolved.version;
  /** Original prop URL — used only if a local preview fails and we fall back to the server proxy. */
  const propFallbackUrl = imageUrl;

  const displayUrl = resolveAvatarDisplayUrl(effectiveUrl, effectiveVersion);
  const needsAuth = Boolean(displayUrl && !isLocalUri(displayUrl));

  const [authHeaders, setAuthHeaders] = useState<Record<string, string> | undefined>();
  const authHeadersRef = useRef<Record<string, string> | undefined>(undefined);
  const [baseUrl, setBaseUrl] = useState<string | null>(null);
  const [overlayUrl, setOverlayUrl] = useState<string | null>(null);
  const [baseFailed, setBaseFailed] = useState(false);
  /** True once a real photo fully covers the AO underlay. */
  const [photoCoversAo, setPhotoCoversAo] = useState(false);
  const overlayFade = useRef(new Animated.Value(0)).current;
  const photoFade = useRef(new Animated.Value(0)).current;
  const baseUrlRef = useRef<string | null>(null);
  const overlayUrlRef = useRef<string | null>(null);
  const displayUrlRef = useRef<string | null>(displayUrl);

  useEffect(() => {
    baseUrlRef.current = baseUrl;
  }, [baseUrl]);

  useEffect(() => {
    overlayUrlRef.current = overlayUrl;
  }, [overlayUrl]);

  useEffect(() => {
    displayUrlRef.current = displayUrl;
  }, [displayUrl]);

  // Sticky auth headers for proxy URLs — local device URIs need none
  useEffect(() => {
    if (!needsAuth) {
      authHeadersRef.current = undefined;
      setAuthHeaders(undefined);
      return;
    }
    let cancelled = false;
    getAccessToken().then((token) => {
      if (cancelled || !token) return;
      const headers = { Authorization: `Bearer ${token}` };
      authHeadersRef.current = headers;
      setAuthHeaders(headers);
    });
    return () => {
      cancelled = true;
    };
  }, [displayUrl, needsAuth]);

  useEffect(() => {
    const next = displayUrl;

    // Real photo → AO avatar: fade photo out, reveal AO
    if (!next) {
      overlayFade.stopAnimation();
      overlayFade.setValue(0);
      setOverlayUrl(null);
      setPhotoCoversAo(false);
      if (!baseUrlRef.current) {
        photoFade.setValue(0);
        setBaseFailed(false);
        return;
      }
      Animated.timing(photoFade, {
        toValue: 0,
        duration: FADE_MS,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished) return;
        if (displayUrlRef.current) return;
        setBaseUrl(null);
        setBaseFailed(false);
      });
      return;
    }

    if (next === baseUrlRef.current || next === overlayUrlRef.current) {
      return;
    }

    // First paint / recover: load base photo (Image stays opacity 1; wrapper fades)
    if (!baseUrlRef.current || baseFailed) {
      overlayFade.stopAnimation();
      overlayFade.setValue(0);
      setOverlayUrl(null);
      setBaseFailed(false);
      setPhotoCoversAo(false);
      photoFade.setValue(0);
      setBaseUrl(next);
      return;
    }

    // Photo A → Photo B
    overlayFade.stopAnimation();
    overlayFade.setValue(0);
    setOverlayUrl(next);
  }, [displayUrl, baseFailed, overlayFade, photoFade]);

  const revealPhoto = () => {
    Animated.timing(photoFade, {
      toValue: 1,
      duration: FADE_MS,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setPhotoCoversAo(true);
    });
  };

  const onBaseLoaded = (loadedUrl: string) => {
    if (loadedUrl !== baseUrlRef.current) return;
    if (overlayUrlRef.current) return;
    if (displayUrlRef.current !== loadedUrl) return;
    revealPhoto();
  };

  const promoteOverlay = (loadedUrl: string) => {
    if (loadedUrl !== overlayUrlRef.current) return;
    if (loadedUrl !== displayUrlRef.current) return;

    Animated.timing(overlayFade, {
      toValue: 1,
      duration: FADE_MS,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) return;
      if (overlayUrlRef.current !== loadedUrl) return;
      photoFade.setValue(1);
      setPhotoCoversAo(true);
      setBaseFailed(false);
      setBaseUrl(loadedUrl);
      setTimeout(() => {
        if (overlayUrlRef.current === loadedUrl && baseUrlRef.current === loadedUrl) {
          setOverlayUrl(null);
          overlayFade.setValue(0);
        }
      }, 50);
    });
  };

  const finishPromote = (loadedUrl: string) => {
    if (loadedUrl !== baseUrlRef.current) return;
    if (overlayUrlRef.current !== loadedUrl) return;
    setOverlayUrl(null);
    overlayFade.setValue(0);
    photoFade.setValue(1);
    setPhotoCoversAo(true);
  };

  const headers = needsAuth ? authHeaders || authHeadersRef.current : undefined;
  const canShowRemote = !needsAuth || !!headers;
  const showBase = Boolean(baseUrl) && !baseFailed && canShowRemote;
  const showOverlay = Boolean(overlayUrl) && canShowRemote;
  // Hide AO once real photo covers it — never leave AO as the visible profile face
  const showEmoji = !photoCoversAo;

  const imageSource = (uri: string) =>
    headers ? { uri, headers } : { uri };

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
            overflow: 'hidden',
          },
        ]}
      >
        {showEmoji ? (
          <Text style={{ fontSize: size * 0.45 }}>{emoji}</Text>
        ) : null}

        {showBase ? (
          <Animated.View
            style={[styles.layer, { width: size, height: size, opacity: photoFade }]}
            pointerEvents="none"
          >
            <Image
              source={imageSource(baseUrl!)}
              style={{ width: size, height: size }}
              onLoad={() => {
                onBaseLoaded(baseUrl!);
                finishPromote(baseUrl!);
              }}
              onError={() => {
                // Local device preview failed — fall back to server proxy URL from props
                if (baseUrl && isLocalUri(baseUrl) && propFallbackUrl) {
                  const fallback = resolveAvatarDisplayUrl(
                    propFallbackUrl,
                    effectiveVersion
                  );
                  if (fallback && fallback !== baseUrl) {
                    setPhotoCoversAo(false);
                    photoFade.setValue(0);
                    setBaseFailed(false);
                    setBaseUrl(fallback);
                    return;
                  }
                }
                // Keep AO underlay; do not clear avatarUrl in app state on transient load failure
                setBaseFailed(true);
                setPhotoCoversAo(false);
                photoFade.setValue(0);
              }}
              accessibilityIgnoresInvertColors
            />
          </Animated.View>
        ) : null}

        {showOverlay ? (
          <Animated.View
            style={[styles.layer, { width: size, height: size, opacity: overlayFade }]}
            pointerEvents="none"
          >
            <Image
              source={imageSource(overlayUrl!)}
              style={{ width: size, height: size }}
              onLoad={() => promoteOverlay(overlayUrl!)}
              onError={() => {
                if (overlayUrlRef.current) {
                  setOverlayUrl(null);
                  overlayFade.setValue(0);
                }
              }}
              accessibilityIgnoresInvertColors
            />
          </Animated.View>
        ) : null}
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
  layer: {
    position: 'absolute',
    left: 0,
    top: 0,
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
