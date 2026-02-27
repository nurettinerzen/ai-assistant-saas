# Launch UI Hardening + Coverage (Site + Panel + P0)

## Summary
- Completed remaining site UI items (hero demo process, integrations icons, expanded integrations page, features deep-dive sections, sector flow links, shared FAQ, concrete about content, mobile layout fixes).
- Added channel session duration analytics (avg + total) for Chat / WhatsApp / Email.
- Applied launch P0 hardening (offline-safe font setup, non-interactive ESLint config, CSP/COOP adjustments for Google GSI, route validation support pages, QA docs).

## Verification
- `npm --prefix frontend run build` passes offline (no Google Fonts dependency).
- `npm --prefix frontend run lint` runs without interactive prompt (non-interactive ESLint config is active).

## Screenshot Evidence

### Home
- Desktop: `frontend/docs/evidence/screenshots/home-desktop.png`
- Mobile (iPhone 13): `frontend/docs/evidence/screenshots/home-mobile-iphone13.png`
- Mobile (360px): `frontend/docs/evidence/screenshots/home-mobile-360.png`

### Pricing
- Desktop: `frontend/docs/evidence/screenshots/pricing-desktop.png`
- Mobile (iPhone 13): `frontend/docs/evidence/screenshots/pricing-mobile-iphone13.png`
- Mobile (360px): `frontend/docs/evidence/screenshots/pricing-mobile-360.png`

### Integrations
- Desktop: `frontend/docs/evidence/screenshots/integrations-desktop.png`
- Mobile (360px): `frontend/docs/evidence/screenshots/integrations-mobile-360.png`

### Features
- Desktop: `frontend/docs/evidence/screenshots/features-desktop.png`
- Mobile (360px): `frontend/docs/evidence/screenshots/features-mobile-360.png`

### Login
- Desktop: `frontend/docs/evidence/screenshots/login-desktop.png`
- Mobile (360px): `frontend/docs/evidence/screenshots/login-mobile-360.png`

## Docs
- Manual QA checklist: `frontend/docs/LAUNCH_UI_QA_CHECKLIST.md`
- Vendor script security note (Google GSI + SRI exception): `frontend/docs/SECURITY_VENDOR_SCRIPT_NOTES.md`

## Remaining Known Gaps
- None.
