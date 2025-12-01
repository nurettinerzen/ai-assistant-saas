#!/bin/bash

echo "================================================"
echo "TELYX.AI - TÜM DEĞİŞİKLİKLERİ GÖRÜNTÜLE"
echo "================================================"
echo ""

# Function to display file with header
show_file() {
    if [ -f "$1" ]; then
        echo ""
        echo "================================================"
        echo "FILE: $1"
        echo "================================================"
        cat "$1"
        echo ""
    else
        echo "⚠️  File not found: $1"
    fi
}

# Backend Services
echo "📁 BACKEND SERVICES"
show_file "/app/backend/src/services/calendly.js"
show_file "/app/backend/src/services/google-calendar.js"
show_file "/app/backend/src/services/hubspot.js"
show_file "/app/backend/src/services/google-sheets.js"
show_file "/app/backend/src/services/whatsapp.js"
show_file "/app/backend/src/services/vapiKnowledge.js"

# Backend Routes
echo "📁 BACKEND ROUTES"
show_file "/app/backend/src/routes/webhooks.js"
show_file "/app/backend/src/data/voip-providers.js"

# Frontend Components
echo "📁 FRONTEND COMPONENTS"
show_file "/app/frontend/components/PhoneNumberModal.jsx"

# Frontend Pages
echo "📁 FRONTEND PAGES"
show_file "/app/frontend/app/dashboard/analytics/page.jsx"
show_file "/app/frontend/app/guides/netgsm-setup/page.jsx"
show_file "/app/frontend/app/guides/bulutfon-setup/page.jsx"

echo ""
echo "================================================"
echo "✅ TÜM DOSYALAR GÖSTERİLDİ"
echo "================================================"
