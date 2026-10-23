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
      backgroundColor: '#0B1220',
      androidScaleType: 'CENTER_CROP',
    },
  },
}

export default config
