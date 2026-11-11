// "Rate us" logic: tracks cumulative play time and decides when to show the banner,
// then opens the store listing (write-review page) for the current platform.
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import {
  ANDROID_PACKAGE,
  APPLE_APP_ID,
  RATE_AFTER_SECONDS,
  RATE_RETRY_SECONDS,
  RATE_MAX_PROMPTS,
} from './Config';

const KEY = 'temple2048:rate';

type Status = 'pending' | 'later' | 'rated' | 'never';

interface RateState {
  status: Status;
  playSeconds: number;
  prompts: number;
  /** play-seconds threshold for the next prompt */
  nextAt: number;
}

function load(): RateState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { status: 'pending', playSeconds: 0, prompts: 0, nextAt: RATE_AFTER_SECONDS, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return { status: 'pending', playSeconds: 0, prompts: 0, nextAt: RATE_AFTER_SECONDS };
}

function save(s: RateState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

class Rating {
  private state = load();
  private shownThisSession = false;

  /** Call once per second while the player is actually playing. */
  tick(seconds = 1): void {
    this.state.playSeconds += seconds;
    if (this.state.playSeconds % 10 === 0) save(this.state);
  }

  get playSeconds(): number {
    return this.state.playSeconds;
  }

  /** True when the banner should be shown now. */
  shouldPrompt(): boolean {
    if (this.shownThisSession) return false;
    const s = this.state;
    if (s.status === 'rated' || s.status === 'never') return false;
    if (s.prompts >= RATE_MAX_PROMPTS) return false;
    if (!this.storeAvailable()) return false;
    return s.playSeconds >= s.nextAt;
  }

  markShown(): void {
    this.shownThisSession = true;
    this.state.prompts += 1;
    save(this.state);
  }

  later(): void {
    this.state.status = 'later';
    this.state.nextAt = this.state.playSeconds + RATE_RETRY_SECONDS;
    save(this.state);
  }

  never(): void {
    this.state.status = 'never';
    save(this.state);
  }

  rated(): void {
    this.state.status = 'rated';
    save(this.state);
  }

  /** Whether we know a store page to send the player to on this platform. */
  storeAvailable(): boolean {
    const p = Capacitor.getPlatform();
    if (p === 'ios') return APPLE_APP_ID.length > 0;
    if (p === 'android') return ANDROID_PACKAGE.length > 0;
    // web build (browser / PWA): send to Google Play listing if there is one
    return ANDROID_PACKAGE.length > 0;
  }

  /** https links: Android opens them in the Play app, iOS in the App Store (write-review page). */
  storeUrl(): string {
    const p = Capacitor.getPlatform();
    if (p === 'ios') return `https://apps.apple.com/app/id${APPLE_APP_ID}?action=write-review`;
    return `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;
  }

  async openStore(): Promise<void> {
    const url = this.storeUrl();
    if (Capacitor.isNativePlatform()) {
      try {
        await Browser.open({ url });
        return;
      } catch {
        /* fall back to the WebView's own window.open */
      }
    }
    window.open(url, '_blank', 'noopener');
  }

  /** Debug helper used by tests: force the prompt on the next check. */
  forceSoon(): void {
    this.state.nextAt = 0;
    this.state.status = 'pending';
    this.shownThisSession = false;
  }
}

export const rating = new Rating();
