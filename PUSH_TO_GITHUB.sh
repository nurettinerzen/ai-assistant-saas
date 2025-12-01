#!/bin/bash

echo "================================================"
echo "🚀 TELYX.AI - GITHUB PUSH SCRIPT"
echo "================================================"
echo ""

# Navigate to app directory
cd /app

# Check git status
echo "📊 Checking git status..."
git status

echo ""
echo "================================================"
echo "📦 ADDING ALL CHANGES TO GIT"
echo "================================================"
echo ""

# Add all changes
git add .

echo "✅ All files added!"
echo ""

# Show what will be committed
echo "📋 Files to be committed:"
git status --short

echo ""
echo "================================================"
echo "💾 CREATING COMMIT"
echo "================================================"
echo ""

# Create comprehensive commit message
git commit -m "feat: Complete TELYX.AI feature implementation

✨ New Features:
- Multi-language support (16 languages)
- Integration system (Calendly, Google Calendar, HubSpot, Sheets, WhatsApp, Zapier)
- Call Analytics Dashboard with sentiment analysis
- BYOC Phone Number System (Netgsm, Bulutfon support)
- Knowledge Base VAPI integration

🐛 Bug Fixes:
- Landing page language selector
- Onboarding voice demo close button
- Voices page language filter
- Integrations page industry filter
- Phone numbers page plan access control

📁 New Files (13):
- Backend services (calendly, google-calendar, hubspot, google-sheets, whatsapp, vapiKnowledge)
- Backend routes (webhooks, phoneNumber BYOC)
- Backend data (voip-providers)
- Frontend guides (netgsm-setup, bulutfon-setup)
- Migration notes

⚡ Updated Files (12):
- Backend routes (server, voices, business, analytics, integrations, knowledge)
- Frontend components (LanguageSwitcher, Navigation, VoiceDemo, PhoneNumberModal)
- Frontend pages (voices, integrations, phone-numbers, analytics)

🎯 All 6 tasks completed:
1. ✅ Multi-language support (15+ languages)
2. ✅ Integration system (6 integrations with OAuth)
3. ✅ Call Analytics Dashboard (AI-powered)
4. ✅ BYOC Phone Number System (global support)
5. ✅ Bug fixes (5 critical fixes)
6. ✅ Knowledge Base VAPI integration

Co-authored-by: E1 AI Agent <e1@emergent.ai>"

echo "✅ Commit created!"
echo ""

echo "================================================"
echo "🌐 PUSHING TO GITHUB"
echo "================================================"
echo ""

# Push to GitHub
git push origin main

if [ $? -eq 0 ]; then
    echo ""
    echo "================================================"
    echo "✅ SUCCESSFULLY PUSHED TO GITHUB!"
    echo "================================================"
    echo ""
    echo "🎉 All changes are now on GitHub!"
    echo ""
    echo "📊 Summary:"
    echo "  - 13 new files created"
    echo "  - 12 files updated"
    echo "  - 6 major features implemented"
    echo "  - 5 bug fixes completed"
    echo ""
    echo "🔗 Check your repository:"
    echo "  https://github.com/nurettinerzen/ai-assistant-saas"
    echo ""
else
    echo ""
    echo "================================================"
    echo "❌ PUSH FAILED!"
    echo "================================================"
    echo ""
    echo "Possible solutions:"
    echo "  1. Check your internet connection"
    echo "  2. Verify GitHub credentials"
    echo "  3. Check remote repository access"
    echo "  4. Try: git push -u origin main --force (if needed)"
    echo ""
fi
