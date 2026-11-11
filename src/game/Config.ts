// Store identifiers used by the "rate us" prompt.
// ANDROID_PACKAGE must match appId in capacitor.config.ts.
// APPLE_APP_ID is the numeric id App Store Connect assigns when you create the app record
// (visible under App Information > Apple ID). Leave empty until then; the iOS button is hidden meanwhile.
export const ANDROID_PACKAGE = 'com.pitystudio.temple2048';
export const APPLE_APP_ID = '';

/** Cumulative play seconds before the rating banner first appears. */
export const RATE_AFTER_SECONDS = 180;
/** Extra play seconds before asking again after "Later". */
export const RATE_RETRY_SECONDS = 180;
/** Never ask more than this many times in total. */
export const RATE_MAX_PROMPTS = 3;
