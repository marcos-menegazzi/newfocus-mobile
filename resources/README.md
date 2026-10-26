# Resources

Source images for app icon and splash screen generation.

- `logo-mark.svg` — vector trace of the NewFocus mark (from `src/assets/logo.png`).
  Every icon and splash below is rendered from it.
- `icon.png` — 1024x1024 app icon (mark on white).
- `splash.png` — 2732x2732 splash (mark centered on white).

Android (`android/app/src/main/res`):

- `mipmap-*/ic_launcher_foreground.png` — adaptive icon foreground (108dp canvas,
  mark at ~48% height, inside the 66dp safe zone); background is `#FFFFFF`
  (`values/ic_launcher_background.xml`).
- `mipmap-*/ic_launcher.png` / `ic_launcher_round.png` — legacy icons (pre Android 8).
- `drawable*/splash.png` — splash for Android < 12. On 12+ the system splash shows
  the adaptive foreground on white (`values/styles.xml`).

iOS: `AppIcon.appiconset/AppIcon-512@2x.png` and `Splash.imageset/*`.
