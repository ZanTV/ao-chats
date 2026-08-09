import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  LayoutChangeEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { Spacing } from '../../theme';

interface Props {
  uri: string;
  durationHint?: number;
  labels: {
    loading: string;
  };
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function AOVideoPlayer({ uri, durationHint, labels }: Props) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.play();
  });

  const [playing, setPlaying] = useState(true);
  const [controls, setControls] = useState(true);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(durationHint || 0);
  const [speedHold, setSpeedHold] = useState(false);
  const [barWidth, setBarWidth] = useState(1);
  const [volume, setVolume] = useState(1);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTap = useRef(0);
  const baseSpeed = useRef(1);

  const scheduleHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setControls(false), 2800);
  }, []);

  useEffect(() => {
    const sub = player.addListener('playingChange', ({ isPlaying }) => {
      setPlaying(isPlaying);
    });
    const status = setInterval(() => {
      try {
        setPosition(player.currentTime || 0);
        const d = player.duration || durationHint || 0;
        if (d > 0) setDuration(d);
      } catch {
        // player may be released
      }
    }, 250);
    scheduleHide();
    return () => {
      sub.remove();
      clearInterval(status);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [player, durationHint, scheduleHide]);

  const togglePlay = useCallback(() => {
    if (player.playing) player.pause();
    else player.play();
    setControls(true);
    scheduleHide();
  }, [player, scheduleHide]);

  const onSurfacePress = () => {
    const now = Date.now();
    if (now - lastTap.current < 280) {
      togglePlay();
      lastTap.current = 0;
      return;
    }
    lastTap.current = now;
    setTimeout(() => {
      if (Date.now() - lastTap.current >= 260) {
        setControls((c) => !c);
        if (!controls) scheduleHide();
      }
    }, 260);
  };

  const startHold2x = () => {
    baseSpeed.current = player.playbackRate || 1;
    player.playbackRate = 2;
    setSpeedHold(true);
  };

  const endHold2x = () => {
    player.playbackRate = baseSpeed.current || 1;
    setSpeedHold(false);
  };

  const seekToRatio = (ratio: number) => {
    const clamped = Math.max(0, Math.min(1, ratio));
    const next = clamped * (duration || 0);
    player.currentTime = next;
    setPosition(next);
    setControls(true);
    scheduleHide();
  };

  const longPress = Gesture.LongPress()
    .minDuration(220)
    .onStart(() => {
      runOnJS(startHold2x)();
    })
    .onEnd(() => {
      runOnJS(endHold2x)();
    })
    .onFinalize(() => {
      runOnJS(endHold2x)();
    });

  const volumeSwipe = Gesture.Pan().onUpdate((e) => {
    if (Platform.OS === 'web') {
      // Browser: adjust player volume (cannot control system volume reliably)
      if (Math.abs(e.translationY) > 8 && Math.abs(e.translationY) > Math.abs(e.translationX)) {
        const next = Math.max(0, Math.min(1, volume - e.translationY / 400));
        runOnJS(setVolume)(next);
        runOnJS((v: number) => {
          player.volume = v;
        })(next);
      }
    }
  });

  const composed = Gesture.Simultaneous(longPress, volumeSwipe);

  return (
    <View style={styles.root}>
      <GestureDetector gesture={composed}>
        <Pressable style={styles.surface} onPress={onSurfacePress}>
          <VideoView
            style={styles.video}
            player={player}
            contentFit="contain"
            nativeControls={false}
            fullscreenOptions={{ enable: true }}
          />
          {speedHold && (
            <View style={styles.speedBadge}>
              <Text style={styles.speedText}>2.0×</Text>
            </View>
          )}
          {!playing && controls && (
            <View style={styles.centerPlay}>
              <Ionicons name="play" size={48} color="#fff" />
            </View>
          )}
        </Pressable>
      </GestureDetector>

      {controls && (
        <View style={styles.controls}>
          <Text style={styles.time}>{formatTime(position)}</Text>
          <Pressable
            style={styles.track}
            onLayout={(e: LayoutChangeEvent) => setBarWidth(e.nativeEvent.layout.width || 1)}
            onPress={(e) => {
              seekToRatio(e.nativeEvent.locationX / barWidth);
            }}
          >
            <View style={styles.trackBg} />
            <View
              style={[
                styles.trackFill,
                { width: `${duration > 0 ? Math.min(100, (position / duration) * 100) : 0}%` },
              ]}
            />
            <View
              style={[
                styles.thumb,
                {
                  left: `${duration > 0 ? Math.min(100, (position / duration) * 100) : 0}%`,
                },
              ]}
            />
          </Pressable>
          <Text style={styles.time}>{formatTime(duration)}</Text>
          <Pressable onPress={togglePlay} hitSlop={8}>
            <Ionicons name={playing ? 'pause' : 'play'} size={22} color="#fff" />
          </Pressable>
        </View>
      )}

      {!uri && (
        <View style={styles.loading}>
          <Text style={{ color: '#fff' }}>{labels.loading}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', justifyContent: 'center' },
  surface: { flex: 1, justifyContent: 'center' },
  video: { width: '100%', height: '100%' },
  controls: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  track: {
    flex: 1,
    height: 28,
    justifyContent: 'center',
  },
  trackBg: {
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  trackFill: {
    position: 'absolute',
    left: 0,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#60A5FA',
  },
  thumb: {
    position: 'absolute',
    marginLeft: -6,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#fff',
  },
  time: { color: '#fff', fontSize: 12, fontVariant: ['tabular-nums'], minWidth: 40 },
  speedBadge: {
    position: 'absolute',
    alignSelf: 'center',
    top: '42%',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  speedText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  centerPlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loading: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
