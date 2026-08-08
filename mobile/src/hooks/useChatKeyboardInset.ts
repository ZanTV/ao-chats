import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

/**
 * Bottom inset so the chat composer stays above the mobile keyboard on Web.
 * iOS uses KeyboardAvoidingView; Android uses softwareKeyboardLayoutMode: 'resize'.
 */
export function useChatKeyboardInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      setInset(0);
      return;
    }
    if (typeof window === 'undefined') return;
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      const covered = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setInset(covered > 40 ? Math.round(covered) : 0);
    };

    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    update();

    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  return inset;
}
