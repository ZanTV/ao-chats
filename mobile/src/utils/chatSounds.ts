import { Platform } from 'react-native';

function bytesToBase64(bytes: Uint8Array): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = bytes[i + 1] ?? 0;
    const c = bytes[i + 2] ?? 0;
    result += chars[a >> 2];
    result += chars[((a & 3) << 4) | (b >> 4)];
    result += i + 1 < bytes.length ? chars[((b & 15) << 2) | (c >> 6)] : '=';
    result += i + 2 < bytes.length ? chars[c & 63] : '=';
  }
  return result;
}

function buildToneWav(frequency: number, durationSec: number, sampleRate = 22050): Uint8Array {
  const numSamples = Math.floor(sampleRate * durationSec);
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  const fadeSamples = Math.min(Math.floor(sampleRate * 0.012), numSamples);
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const fadeIn = Math.min(1, i / fadeSamples);
    const fadeOut = Math.min(1, (numSamples - i) / fadeSamples);
    const envelope = fadeIn * fadeOut;
    const sample = Math.sin(2 * Math.PI * frequency * t) * envelope * 0.35;
    view.setInt16(44 + i * 2, sample * 32767, true);
  }

  return new Uint8Array(buffer);
}

function playWebTone(frequency: number, durationMs: number, delayMs = 0): void {
  if (typeof window === 'undefined') return;
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return;

  const ctx = new AudioCtx();
  const startAt = ctx.currentTime + delayMs / 1000;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(0.22, startAt + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + durationMs / 1000);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startAt);
  osc.stop(startAt + durationMs / 1000 + 0.02);
  osc.onended = () => {
    ctx.close().catch(() => {});
  };
}

let nativeAudioReady = false;

async function playNativeTone(frequency: number, durationMs: number, delayMs = 0): Promise<void> {
  if (Platform.OS === 'web') return;

  const play = async () => {
    try {
      const { AudioModule, setAudioModeAsync } = await import('expo-audio');
      if (!nativeAudioReady) {
        await setAudioModeAsync({
          playsInSilentMode: true,
          shouldPlayInBackground: false,
          interruptionMode: 'mixWithOthers',
        });
        nativeAudioReady = true;
      }

      const wav = buildToneWav(frequency, durationMs / 1000);
      const uri = `data:audio/wav;base64,${bytesToBase64(wav)}`;
      const player = new AudioModule.AudioPlayer(uri, 100, false, 0);
      player.volume = 0.35;
      player.play();
      setTimeout(() => {
        try {
          player.release();
        } catch {
          // ignore
        }
      }, durationMs + 250);
    } catch {
      // audio optional
    }
  };

  if (delayMs > 0) {
    setTimeout(() => {
      play().catch(() => {});
    }, delayMs);
  } else {
    await play();
  }
}

/** Short high tone — message sent */
export async function playSentChatSound(): Promise<void> {
  if (Platform.OS === 'web') {
    playWebTone(920, 65);
    return;
  }
  await playNativeTone(920, 65);
}

/** Two-tone chime — message received */
export async function playReceivedChatSound(): Promise<void> {
  if (Platform.OS === 'web') {
    playWebTone(620, 55);
    playWebTone(780, 70, 75);
    return;
  }
  void playNativeTone(620, 55);
  void playNativeTone(780, 70, 75);
}
