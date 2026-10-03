/**
 * Mobile Device Utilities (Haptics, Notifications & Storage)
 * Supports native Android Capacitor bridging and Web Mobile APIs
 */

export function triggerHaptic(type: 'light' | 'medium' | 'heavy' | 'success' | 'error' = 'light') {
  if (typeof window === 'undefined' || !('vibrate' in navigator)) return;

  try {
    switch (type) {
      case 'light':
        navigator.vibrate(8);
        break;
      case 'medium':
        navigator.vibrate(20);
        break;
      case 'heavy':
        navigator.vibrate([30, 20, 30]);
        break;
      case 'success':
        navigator.vibrate([10, 30, 15]);
        break;
      case 'error':
        navigator.vibrate([25, 40, 25, 40]);
        break;
    }
  } catch {
    // Silently ignore if disabled by user agent
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const perm = await Notification.requestPermission();
    return perm === 'granted';
  }

  return false;
}

export function sendLocalNotification(
  title: string,
  body: string,
  tag: string = 'aura-signal'
) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;

  if (Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body,
        icon: '/favicon.ico',
        tag,
        badge: '/favicon.ico',
      });
      triggerHaptic('success');
    } catch {
      // Notification failed or blocked
    }
  }
}

export interface AppPreferences {
  customBackendUrl: string;
  notificationsEnabled: boolean;
  xauusdAlerts: boolean;
  usdjpyAlerts: boolean;
  minConfidence: number;
  hapticsEnabled: boolean;
  formatDecimals: boolean;
}

const STORAGE_KEY = 'aura_mt5_preferences_v1';

export const defaultPreferences: AppPreferences = {
  customBackendUrl: '',
  notificationsEnabled: true,
  xauusdAlerts: true,
  usdjpyAlerts: true,
  minConfidence: 75,
  hapticsEnabled: true,
  formatDecimals: true,
};

export function loadPreferences(): AppPreferences {
  if (typeof window === 'undefined') return defaultPreferences;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return { ...defaultPreferences, ...JSON.parse(raw) };
    }
  } catch {
    // fallback
  }
  return defaultPreferences;
}

export function savePreferences(prefs: AppPreferences): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // storage unavailable
  }
}
