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
3. Settings tab: under OAuth 2 Redirect URIs add `https://mattclarke873.github.io/dialit/` (the Sync tab shows the exact address).
4. Copy the App key.
5. In the home screen app: Sync tab › paste App key › Connect Dropbox › Allow.

Data lives in `Dropbox/Apps/DialIt/dialit.json`. Everything saves on the phone first; sync runs after each change, when the app opens, and when signal comes back. Connect from the home screen app, not Safari, as iPhone keeps their storage apart.

## Updating
Change `VERSION` in `sw.js` (for example `dialit-v3`) whenever you change a file, so phones pick up the new copy.

## Notes
- Drop uses a point-mass G1/G7 drag model at standard sea-level air. Check it against real shots.
- Corrections use true MIL (1/1000 radian) and true MOA (1/60 degree).
- Log exports to CSV from the Log tab.
