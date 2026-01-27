#!/bin/bash

# P1: Apply PRO+ gating to email usage endpoints
# Keep OAuth connect/disconnect/status FREE

FILE="src/routes/email.js"

# Endpoints that should remain FREE (OAuth connection management)
# - /gmail/auth, /gmail/callback
# - /outlook/auth, /outlook/callback
# - /status, /disconnect
# - /webhook/* (internal)

# All other endpoints need requireProOrAbove

echo "Applying PRO+ gating to email usage endpoints..."

# Usage endpoints to gate:
# /threads, /threads/:id, /threads/:id/close, /threads/:id/generate-draft
# /drafts, /drafts/:id, /drafts/:id/*, /sync, /stats, etc.

# Pattern: authenticateToken, async (req, res)
# Replace with: authenticateToken, requireProOrAbove, async (req, res)

# Exclude lines already having requireProOrAbove or containing auth/callback/status/disconnect/webhook

sed -i.bak \
  -E '/gmail\/auth|gmail\/callback|outlook\/auth|outlook\/callback|\/status|\/disconnect|\/webhook|requireProOrAbove/! s/(router\.(get|post|put|patch|delete)\([^,]+,\s*authenticateToken),\s*async\s*\(req,\s*res\)/\1, requireProOrAbove, async (req, res)/g' \
  "$FILE"

echo "Done! Check git diff to verify changes."
echo "Backup saved as: ${FILE}.bak"
