# BuildFlow Buyer (`@buildflow/buyer`)

Thin B2B ordering app for the **Ice cream manufacturer** vertical.

Buyers log in with manufacturer-issued credentials, browse the published catalog, place orders (creates `SalesOrder` with `source=B2B_APP` in the manufacturer Inventory tenant), and track shipping.

## Run locally

```bash
# from repo root (API must be on :4000)
pnpm install
pnpm --filter @buildflow/buyer start
```

Demo buyer (after seed): `buyer@cityscoop.com` / OTP `111111`

## Play Store

1. Create an EAS project and set `extra.eas.projectId` in `app.json`.
2. `npx eas build -p android --profile preview` (add `eas.json` as needed).
3. Upload the AAB to Play Console internal testing.

Package id: `com.buildflow.buyer`

## API

- `POST /api/buyer/auth/send-otp`
- `POST /api/buyer/auth/login`
- `GET /api/buyer/catalog` (Bearer buyer JWT)
- `POST /api/buyer/orders`
- `GET /api/buyer/orders`
