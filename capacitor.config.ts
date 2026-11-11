import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pitystudio.temple2048',
  appName: 'Temple 2048',
  webDir: 'dist',
  backgroundColor: '#06331f',
  server: { androidScheme: 'https' },
  ios: { contentInset: 'never' },
};

export default config;
