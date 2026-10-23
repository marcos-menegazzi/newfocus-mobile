# Resources

Source images for app icon and splash screen generation.

- `icon.png` — 1024x1024 app icon (from legacy `res/android/1024.png`).
- `splash.png` — 256x256 logo (from legacy `res/logo.png`).

Final icon/splash assets should be generated with Capacitor's asset tooling
(not installed in this repo yet):

```
npx @capacitor/assets generate --iconBackgroundColor '#ffffff' --splashBackgroundColor '#ffffff'
```
