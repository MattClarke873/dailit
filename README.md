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
4. In the home screen app: Settings tab › paste App key › Get code.
5. Dropbox opens. Sign in, press Allow, copy the code it shows.
6. Back in the app: paste the code › Link Dropbox.

The code works once and only for a few minutes. If Link fails, press Get code again for a fresh one.

Data lives in `Dropbox/Apps/DialIt/dialit.json`. Everything saves on the phone first; sync runs after each change, when the app opens, and when signal comes back. Link from the home screen app, as iPhone keeps its storage apart from Safari.

## Updating
Change `VERSION` in `sw.js` (for example `dialit-v10`) whenever you change a file, so phones pick up the new copy. If you add a file, add it to `FILES` in `sw.js` too, or it won't work offline.

## Air
Dial tab › Air card. Get weather here uses phone location, GPS altitude and Open-Meteo (free, no key) for temperature, humidity and sea-level pressure (QNH). No signal: altitude still comes from GPS, type the rest. Pressure can be sea level (QNH) or where you are (station, e.g. Kestrel). Density altitude is shown. Set to Standard to use 15°C at sea level.

## Files
- `index.html`: the screens.
- `css/app.css`: the look, including night mode.
- `fonts/archivo.woff2`: the font, kept here so it works offline.
- `js/`: the code, one file per part of the app. `ballistics.js` is the flight maths; the rest are named after the screen they run.
- `sw.js`: keeps a copy of every file on the phone so the app opens with no signal.

Upload the folders as well as the files when you put it on GitHub Pages.

## What's where
- **Dial**: rifle, air, target range, angle (Measure uses the tilt sensor), wind clock (Use forecast wind uses the compass), where it hit (or Group from photo). Results show Range and wind or Fix my miss, two turrets, and a reticle hold.
- **Kit**: Rifles (round count, cleaning, barrel life, True the gun), Ammo (factory or home load with recipe; pick the calibre from your list in Settings, so stock adds up under one name; stock vs certificate limit per calibre; Retire keeps history; Stock report to print or export for your FEO), Chrono (average, ES, SD, set as muzzle speed).
- **Log**: sessions and shots, CSV export.
- **Dope**: printable range card for the rifle in use, plus saved ranges.
- **Settings**: calibres and certificate limits, Dropbox sync, and Backup: save everything to one file and restore it. Restoring merges; newer changes win.

## Night mode
The moon button on the Dial tab switches to red on black, to keep your night vision. Press it again for day.

## Powder temperature and spin drift
Kit › Rifles › edit. Powder temperature: enter the temperature the speed was measured at and how much it changes per degree. The app moves the speed for the air temperature set now. Chrono sessions record the temperature; two or more sessions at least 5° apart give a suggested figure. Spin drift: pick the barrel twist (most are right) and the stability (1.5 is typical). It is added to the windage and shown as its own column on the range card.

Results warn when the bullet is near or below the speed of sound at the target; those rows are marked * on the range card.

The first time you press Measure or Use forecast wind, iPhone asks to allow motion and orientation. Say Allow.

## Notes
- Drop uses a point-mass G1/G7 drag model with the air you set. The zero is worked out in the same air. Check it against real shots.
- Corrections use true MIL (1/1000 radian) and true MOA (1/60 degree).
- Log exports to CSV from the Log tab.
