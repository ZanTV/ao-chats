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
import { bustAvatarUrl } from '../utils/avatarUrl';
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
  const propUrl = imageUrl ?? null;

  let effectiveUrl = propUrl;
  let effectiveVersion = propVersion;
  if (synced?.urlKnown) {
    if (synced.avatarVersion > propVersion) {
      effectiveUrl = synced.avatarUrl;
      effectiveVersion = synced.avatarVersion;
    } else if (synced.avatarVersion === propVersion) {
      effectiveUrl = synced.avatarUrl;
      effectiveVersion = synced.avatarVersion;
    }
  }

  const displayUrl = bustAvatarUrl(effectiveUrl, effectiveVersion);

  const [authHeaders, setAuthHeaders] = useState<Record<string, string> | undefined>();
  const authHeadersRef = useRef<Record<string, string> | undefined>(undefined);
  const [baseUrl, setBaseUrl] = useState<string | null>(null);
  const [overlayUrl, setOverlayUrl] = useState<string | null>(null);
  const [baseFailed, setBaseFailed] = useState(false);
  const fade = useRef(new Animated.Value(0)).current;
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

    // Cleared custom photo → keep last frame briefly is not required; show emoji
    if (!next) {
      fade.stopAnimation();
      fade.setValue(0);
      setOverlayUrl(null);
      setBaseUrl(null);
      setBaseFailed(false);
      return;
    }

    // Same as what we already show
    if (next === baseUrlRef.current || next === overlayUrlRef.current) {
      return;
    }

    const headers = authHeadersRef.current;
    // First paint (or recovering from failure): set base without unmount flicker
    if (!baseUrlRef.current || baseFailed) {
      fade.stopAnimation();
      fade.setValue(0);
      setOverlayUrl(null);
      setBaseFailed(false);
      setBaseUrl(next);
      return;
    }

    // Crossfade: keep base visible, load overlay, then promote
    fade.stopAnimation();
    fade.setValue(0);
    setOverlayUrl(next);
  }, [displayUrl, baseFailed, fade]);

  const promoteOverlay = (loadedUrl: string) => {
    // Ignore stale loads
    if (loadedUrl !== overlayUrlRef.current) return;
    if (loadedUrl !== displayUrlRef.current) return;

    Animated.timing(fade, {
      toValue: 1,
      duration: FADE_MS,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) return;
      if (overlayUrlRef.current !== loadedUrl) return;
      // Keep overlay painted while base Image adopts the new URI (avoids blank/flicker).
      setBaseFailed(false);
      setBaseUrl(loadedUrl);
      // Fallback if base onLoad is skipped (cache hit / same decode path)
      setTimeout(() => {
        if (overlayUrlRef.current === loadedUrl && baseUrlRef.current === loadedUrl) {
          setOverlayUrl(null);
          fade.setValue(0);
        }
      }, 50);
    });
  };

  const finishPromote = (loadedUrl: string) => {
    if (loadedUrl !== baseUrlRef.current) return;
    if (overlayUrlRef.current !== loadedUrl) return;
    setOverlayUrl(null);
    fade.setValue(0);
  };

  const headers = authHeaders || authHeadersRef.current;
  const showBase = Boolean(baseUrl) && !baseFailed && !!headers;
  const showOverlay = Boolean(overlayUrl) && !!headers;
  // Never flash emoji while a photo URI is resolving / waiting on auth headers
  const showEmoji = !baseUrl && !overlayUrl && !displayUrl;

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
          <Image
            source={{ uri: baseUrl!, headers }}
            style={[styles.layer, { width: size, height: size, opacity: 1 }]}
            onLoad={() => finishPromote(baseUrl!)}
            onError={() => setBaseFailed(true)}
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
                opacity: fade,
              },
            ]}
            onLoad={() => promoteOverlay(overlayUrl!)}
            onError={() => {
              if (overlayUrlRef.current) {
                setOverlayUrl(null);
                fade.setValue(0);
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
