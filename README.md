# Dial it

Scope clicks, bullet drop, rifle profiles, shooting log and dope card. Works with no signal. Syncs to Dropbox when it can.

## Put it on GitHub Pages
1. New repo, for example `dialit`. Upload every file in this folder to the top level.
2. Settings › Pages › Deploy from branch › `main` / root › Save.
3. Address will be `https://mattclarke873.github.io/dialit/`

## Add to iPhone home screen
1. Open the address in Safari with signal.
2. Share › Add to Home Screen.
3. Open it from the home screen once while online. After that it runs offline.

## Dropbox sync
1. dropbox.com/developers › Create app › Scoped access › App folder › name it (for example `DialIt`).
2. Permissions tab: tick `files.content.read` and `files.content.write`, then Submit.
3. Settings tab: copy the App key. No redirect URI needed.
4. In the home screen app: Sync tab › paste App key › Get code.
5. Dropbox opens. Sign in, press Allow, copy the code it shows.
6. Back in the app: paste the code › Link Dropbox.

The code works once and only for a few minutes. If Link fails, press Get code again for a fresh one.

Data lives in `Dropbox/Apps/DialIt/dialit.json`. Everything saves on the phone first; sync runs after each change, when the app opens, and when signal comes back. Link from the home screen app, as iPhone keeps its storage apart from Safari.

## Updating
Change `VERSION` in `sw.js` (for example `dialit-v3`) whenever you change a file, so phones pick up the new copy.

## Air
Dial tab › Air card. Get weather here uses phone location, GPS altitude and Open-Meteo (free, no key) for temperature, humidity and sea-level pressure (QNH). No signal: altitude still comes from GPS, type the rest. Pressure can be sea level (QNH) or where you are (station, e.g. Kestrel). Density altitude is shown. Set to Standard to use 15°C at sea level.

## Notes
- Drop uses a point-mass G1/G7 drag model with the air you set. The zero is worked out in the same air. Check it against real shots.
- Corrections use true MIL (1/1000 radian) and true MOA (1/60 degree).
- Log exports to CSV from the Log tab.
