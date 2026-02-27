# Security Vendor Script Notes

## Google GSI script and SRI

The login page loads Google Identity Services from:

- `https://accounts.google.com/gsi/client`

Subresource Integrity (SRI) is not applied for this vendor script because:

1. The script is hosted and versioned dynamically by Google.
2. A fixed integrity hash is not stable across updates.
3. Integrity mismatch would break login without code changes on our side.

Risk handling in this project:

- CSP allowlist is restricted to required Google domains for script/style/frame.
- Google login is isolated to auth pages with `Cross-Origin-Opener-Policy: same-origin-allow-popups`.
- No additional third-party script loaders are used for GSI.
