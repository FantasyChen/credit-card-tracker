import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.perksreminder.app',
  appName: 'Perks Reminder',
  webDir: 'capacitor-web',
  backgroundColor: '#ffffff',
  server: {
    url: 'https://www.perks-reminder.com',
    cleartext: false,
    errorPath: 'index.html',
    allowNavigation: [
      'www.perks-reminder.com',
      'perks-reminder.com',
      'loyalty.perks-reminder.com',
    ],
  },
  ios: {
    contentInset: 'automatic',
    allowsLinkPreview: false,
    backgroundColor: '#ffffff',
  },
};

export default config;
