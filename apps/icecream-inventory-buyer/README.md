# Jora Trade (`@buildflow/icecream-inventory-buyer`)

Invite-only B2B ordering app. Buyers **must** receive an invite code from their ice cream manufacturer / supplier (BuildFlow inventory). After joining, returning sign-in uses the registered email/mobile **OTP**. Browse catalog, place orders (`SalesOrder` `source=B2B_APP`); suppliers get `B2B_ORDER_PLACED` (Sales → focused order).

**Play Store name:** Jora Trade · **Package:** `com.joraai.joratrade`

**Play Console high-res icon:** upload `assets/play-icon-512.png` (512×512 PNG, full-bleed, &lt;1 MB).

**Feature graphic + phone/tablet screenshots:** see `store-listing/README.md`.

## Run locally

```bash
# from repo root — API on Render or localhost
pnpm install
# optional: copy .env.example → .env and point at local API
pnpm --filter @buildflow/icecream-inventory-buyer start
```

Demo buyer (after seed): `buyer@cityscoop.com` / OTP from SMS or master/dev code when enabled.

Default API: `https://buildflow-api-backend.onrender.com/api` (override with `EXPO_PUBLIC_API_URL`).

## Play Store / EAS

1. From this app directory: `npx eas init` — paste the project id into `app.json` → `extra.eas.projectId`.
2. Preview APK: `npx eas build -p android --profile preview`
3. Production AAB: `npx eas build -p android --profile production`
4. Upload AAB to Play Console internal testing.

Privacy / Terms / SMS opt-in (store listing + in-app links):

- https://build-flow-frontend-jet.vercel.app/privacy
- https://build-flow-frontend-jet.vercel.app/terms
- https://build-flow-frontend-jet.vercel.app/sms-opt-in

## API

- `POST /api/buyer/auth/preview-invite`
- `POST /api/buyer/auth/claim-invite`
- `POST /api/buyer/auth/send-otp`
- `POST /api/buyer/auth/login`
- `GET /api/buyer/catalog` (Bearer buyer JWT)
- `GET /api/buyer/profile` / `PATCH /api/buyer/profile`
- `POST /api/buyer/orders`
- `GET /api/buyer/orders`
