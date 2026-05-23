# Merge Game

A casual merge puzzle game. Runs as a PWA — installs on iPad via Safari, no App Store required.

## Run locally

```bash
python -m http.server 8765
```

Open: http://localhost:8765

## Deploy (first time)

1. Push repo to GitHub (already done)
2. GitHub → Settings → Pages → Branch: **master** / **(root)** → Save
3. Game will be live at:  
   `https://baalurad.github.io/merge-game/`

## Install on iPad

1. Open the link above in **Safari**
2. Tap Share → **Add to Home Screen**
3. Done — works offline from the home screen icon

## Release a patch

1. Make your changes
2. Bump the version in `version.js`:
   ```js
   const APP_VERSION = '0.0.2';
   ```
3. Push:
   ```bash
   git add .
   git commit -m "v0.0.2: description of changes"
   git push
   ```

The player gets the update on the next app launch (with internet on).
