# LAUNCH UI QA CHECKLIST

## 1) Desktop page checks
- [ ] `/` Home: hero CTA, demo process (3 adim), integrations icons, section spacing
- [ ] `/pricing`: package cards, overage table, decision CTA, no clipping
- [ ] `/integrations`: 5 categories, 12+ cards, status badges, CTA routes
- [ ] `/features`: deep-dive sections (Dashboard/KPI, Guvenlik/KVKK, Entegrasyonlar), sektorel cozum kartlari, FAQ
- [ ] `/solutions` and `/solutions/*`: each detail page includes 3-step example flow
- [ ] `/about`: company info block + team roles + legal address fallback behavior
- [ ] `/login`: password show/hide toggle, Google button, no layout overflow

## 2) Mobile page checks (iPhone 13 + 360px Android)
- [ ] Home: hero buttons full width on mobile, demo process cards wrap correctly
- [ ] Pricing: cards and table area keep readable spacing, no text clipping
- [ ] Login: logo + language switcher does not overflow card width
- [ ] Integrations: cards stack correctly, badges and CTA remain readable
- [ ] Features: cards, deep-dive blocks, FAQ accordion spacing

## 3) CTA route validation
- [ ] Home CTA primary -> `/signup` (200)
- [ ] Home CTA secondary -> `/contact` (200)
- [ ] Pricing CTA buttons do not produce 404
- [ ] Integrations card CTA targets do not produce 404

## 4) Login checks
- [ ] Password input toggle works (show/hide)
- [ ] Google Sign-In popup opens and returns without CSP console errors
- [ ] COOP policy on login/signup allows popup flow

## 5) SEO/public routes
- [ ] `/sitemap.xml` renders
- [ ] `/robots.txt` renders and includes sitemap reference

## 6) Content validation
- [ ] TR/EN locale switch correctly updates new sections (Hero demo process, Features deep-dive, FAQ, Integrations statuses)
- [ ] About page env fallback texts are shown when company env vars are absent
- [ ] No external CDN assets for new icons/fonts

## 7) Security note
- [ ] See `frontend/docs/SECURITY_VENDOR_SCRIPT_NOTES.md` for GSI SRI exception note
