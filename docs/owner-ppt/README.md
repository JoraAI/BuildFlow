# BuildFlow Owner Construction ERP Guide (PPT)

## Deliverable
**[`BuildFlow_Owner_Construction_ERP_Guide.pptx`](./BuildFlow_Owner_Construction_ERP_Guide.pptx)**

Owner quick-start with **live screenshots** on:
- **Web** (desktop 1440×900)
- **iOS** (iPhone 14 emulation)
- **Android** (Pixel 7 emulation)

Demo login: `owner@reddyconst.com` (Construction ERP — Reddy Constructions).

## Slide map
1. Title (Android · iOS · Web)
2. One product — three surfaces
3. Agenda
4–14. Feature slides with **Web + iOS + Android** side-by-side
15. Who does what
16. Day-1 checklist (phone + web)
17. Closing

## Regenerate screenshots + PPT
```bash
# Need API :4000 and Expo web :8081
cd docs/owner-ppt
node capture-all-platforms.mjs
cd ../.. && .venv-pptx/bin/python docs/owner-ppt/build_ppt.py
```

Folders:
- `screenshots/web/`
- `screenshots/mobile/` (iOS)
- `screenshots/android/`
