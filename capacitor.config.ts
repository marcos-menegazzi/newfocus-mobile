import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.cordova.newfocus',
  appName: 'NewFocus',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#F0E8D8',
      androidScaleType: 'CENTER_CROP',
    },
  },
}

export default config
