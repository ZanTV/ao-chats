import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ViewStyle,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AvatarColors, AvatarEmojis, BorderRadius } from '../theme';
import { getAccessToken } from '../services/storage';
import { bustAvatarUrl, normalizeAvatarUrl } from '../utils/avatarUrl';
import { useAvatarSyncStore } from '../profile/avatarSyncStore';

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

/**
 * Precedence: valid avatarUrl (realtime sync or props) > AO avatarId emoji.
 * AO emoji stays as underlay so photo↔AO transitions never blank the circle.
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
  const color = AvatarColors[avatarId] || AvatarColors['avatar-30'];
  const emoji = AvatarEmojis[avatarId] || '💠';

  const synced = useAvatarSyncStore((s) =>
    userId ? s.byUserId[userId] : undefined
  );

  const propVersion =
    typeof imageVersion === 'number' && Number.isFinite(imageVersion)
      ? imageVersion
      : 0;
  const propUrl = normalizeAvatarUrl(imageUrl);

  let effectiveUrl = propUrl;
  let effectiveVersion = propVersion;
  if (synced?.urlKnown) {
    if (synced.avatarVersion > propVersion) {
      effectiveUrl = normalizeAvatarUrl(synced.avatarUrl);
      effectiveVersion = synced.avatarVersion;
    } else if (synced.avatarVersion === propVersion) {
      effectiveUrl = normalizeAvatarUrl(synced.avatarUrl);
      effectiveVersion = synced.avatarVersion;
    }
  }

  const displayUrl = bustAvatarUrl(effectiveUrl, effectiveVersion);

  const [authHeaders, setAuthHeaders] = useState<Record<string, string> | undefined>();
  const authHeadersRef = useRef<Record<string, string> | undefined>(undefined);
  const [baseUrl, setBaseUrl] = useState<string | null>(null);
  const [overlayUrl, setOverlayUrl] = useState<string | null>(null);
  const [baseFailed, setBaseFailed] = useState(false);
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

  // Sticky auth headers — never blank the avatar while token resolves
  useEffect(() => {
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
  }, [displayUrl]);

  useEffect(() => {
    const next = displayUrl;

    // Real photo → AO avatar: fade photo out over emoji underlay
    if (!next) {
      overlayFade.stopAnimation();
      overlayFade.setValue(0);
      setOverlayUrl(null);
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

    // Same as what we already show
    if (next === baseUrlRef.current || next === overlayUrlRef.current) {
      return;
    }

    // First paint / recover failure: load as base, fade in over AO emoji
    if (!baseUrlRef.current || baseFailed) {
      overlayFade.stopAnimation();
      overlayFade.setValue(0);
      setOverlayUrl(null);
      setBaseFailed(false);
      photoFade.setValue(0);
      setBaseUrl(next);
      return;
    }

    // Photo A → Photo B: keep A, crossfade B
    overlayFade.stopAnimation();
    overlayFade.setValue(0);
    setOverlayUrl(next);
  }, [displayUrl, baseFailed, overlayFade, photoFade]);

  const onBaseLoaded = (loadedUrl: string) => {
    if (loadedUrl !== baseUrlRef.current) return;
    if (overlayUrlRef.current) {
      // Waiting for overlay promote — keep base visible
      return;
    }
    if (displayUrlRef.current !== loadedUrl) return;
    Animated.timing(photoFade, {
      toValue: 1,
      duration: FADE_MS,
      useNativeDriver: true,
    }).start();
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
  };

  const headers = authHeaders || authHeadersRef.current;
  const showBase = Boolean(baseUrl) && !baseFailed && !!headers;
  const showOverlay = Boolean(overlayUrl) && !!headers;

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
        {/* AO avatar underlay — never remove while a photo is loading/clearing */}
        <Text style={{ fontSize: size * 0.45 }}>{emoji}</Text>

        {showBase ? (
          <Animated.Image
            source={{ uri: baseUrl!, headers }}
            style={[
              styles.layer,
              { width: size, height: size, opacity: photoFade },
            ]}
            onLoad={() => {
              onBaseLoaded(baseUrl!);
              finishPromote(baseUrl!);
            }}
            onError={() => {
              setBaseFailed(true);
              photoFade.setValue(0);
            }}
            accessibilityIgnoresInvertColors
          />
        ) : null}

        {showOverlay ? (
          <Animated.Image
            source={{ uri: overlayUrl!, headers }}
            style={[
              styles.layer,
              {
                width: size,
                height: size,
                opacity: overlayFade,
              },
            ]}
            onLoad={() => promoteOverlay(overlayUrl!)}
            onError={() => {
              if (overlayUrlRef.current) {
                setOverlayUrl(null);
                overlayFade.setValue(0);
              }
            }}
            accessibilityIgnoresInvertColors
          />
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
