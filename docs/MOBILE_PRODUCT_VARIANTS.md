# Mobile product variants (BuildFlow vs BuildFlow Inventory)

## Goal

- **Native / Play:** two installs so updates do not cross products.
  - **BuildFlow** — `com.jora.buildflow` — construction ERP (`EXPO_PUBLIC_APP_VARIANT=construction`)
  - **BuildFlow Inventory** — `com.jora.buildflow.inventory` — inventory owner app (`EXPO_PUBLIC_APP_VARIANT=inventory`)
- **Web:** unchanged single SPA (variant unset / `web`). Login still routes by `productMode`.

Jora Trade (`com.joraai.joratrade`) remains a separate buyer app.

## Build

From `apps/mobile`:

```bash
# Construction AAB
eas build -p android --profile construction

# Inventory AAB
eas build -p android --profile inventory

# Preview APKs
eas build -p android --profile construction-preview
eas build -p android --profile inventory-preview
```

Web: `pnpm --filter @buildflow/mobile run build:web` (no variant → both shells).

## Wrong-product login

If a construction account opens the Inventory APK (or the reverse), the app shows **Wrong app** and offers sign-out. It does not open the other product shell on a locked native build. Invite preview includes `productMode` so the wrong native app blocks accept before OTP.

## Marketing / signup

Native locked builds only show that product’s trial CTAs, pricing, FAQ, and About copy. Web keeps the dual-product marketing surface.

## Update isolation

Store / EAS submits are per applicationId. Shipping an Inventory AAB does not update Construction installs (and vice versa). Shared API and the shared web deploy are separate concerns.
