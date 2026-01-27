# TELYX AI — Implementation Guide

This guide provides specific file paths, code changes, and step-by-step instructions for implementing the design system refresh.

---

## Sprint 1: Foundation + Navigation + Integrations (Days 1-3)

### Task 1.1: Typography System

**Files to modify:**

1. **Install Plus Jakarta Sans**

```bash
# If using Google Fonts (recommended)
# Add to app/layout.jsx or globals.css
```

**File: `app/layout.jsx`**
```jsx
import { Plus_Jakarta_Sans } from 'next/font/google'

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plus-jakarta',
})

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={plusJakarta.variable}>
      <body className={plusJakarta.className}>{children}</body>
    </html>
  )
}
```

**File: `tailwind.config.js`**
```js
module.exports = {
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-plus-jakarta)', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        // Standardized type scale
        'xs': ['12px', { lineHeight: '1.4' }],      // Caption
        'sm': ['13px', { lineHeight: '1.5' }],      // Small text
        'base': ['14px', { lineHeight: '1.6' }],    // Body
        'md': ['16px', { lineHeight: '1.5' }],      // H3
        'lg': ['18px', { lineHeight: '1.4' }],      // H2
        'xl': ['24px', { lineHeight: '1.3' }],      // Unused (gap)
        '2xl': ['32px', { lineHeight: '1.2' }],     // H1
      },
    },
  },
}
```

**File: `app/globals.css`**
```css
/* Remove any existing Inter font imports */
/* Add Plus Jakarta Sans if not using next/font */
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');

/* Update base styles */
body {
  font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
  font-size: 14px;
  line-height: 1.6;
  color: #111827; /* gray-900 */
}

h1, .h1 {
  font-size: 32px;
  font-weight: 700;
  line-height: 1.2;
}

h2, .h2 {
  font-size: 18px;
  font-weight: 600;
  line-height: 1.4;
}

h3, .h3 {
  font-size: 16px;
  font-weight: 600;
  line-height: 1.5;
}

/* Remove any colored text utility classes that shouldn't exist */
.text-purple-600,
.text-blue-600 {
  @apply text-gray-600; /* Force to gray */
}
```

---

### Task 1.2: Color System Update

**File: `tailwind.config.js`**
```js
module.exports = {
  theme: {
    extend: {
      colors: {
        // Primary - Indigo (brand)
        primary: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',  // Main
          600: '#4f46e5',  // Hover
          700: '#4338ca',  // Active
          800: '#3730a3',
          900: '#312e81',
        },
        // Accent - Cyan (minimal usage)
        accent: {
          50: '#ecfeff',
          100: '#cffafe',
          200: '#a5f3fc',
          300: '#67e8f9',
          400: '#22d3ee',  // Badge highlight
          500: '#06b6d4',  // Selected
          600: '#0891b2',  // Hover
          700: '#0e7490',
          800: '#155e75',
          900: '#164e63',
        },
        // Keep existing semantic colors (success, warning, error, info)
      },
    },
  },
}
```

**File: `app/globals.css`**
```css
:root {
  /* Light mode */
  --color-primary: #6366f1;
  --color-primary-hover: #4f46e5;
  --color-accent: #06b6d4;

  --color-text: #111827;
  --color-text-secondary: #4b5563;
  --color-text-muted: #6b7280;

  --color-border: #e5e7eb;
  --color-bg: #ffffff;
  --color-bg-subtle: #f9fafb;
}

.dark {
  /* Dark mode */
  --color-text: #f3f4f6;
  --color-text-secondary: #9ca3af;
  --color-text-muted: #6b7280;

  --color-border: #374151;
  --color-bg: #111827;
  --color-bg-subtle: #1f2937;
}

/* Remove any purple/blue background utility classes */
.info-box,
.description-box,
.note-box {
  @apply bg-transparent border-none p-0;
  @apply text-gray-600;
}
```

---

### Task 1.3: Remove Colored Explanation Boxes

**Search and Replace Across Codebase:**

```bash
# Find all colored info boxes
grep -r "bg-purple-" app/
grep -r "bg-blue-100" app/
grep -r "bg-indigo-50" app/
```

**Pattern to find:**
```jsx
// ❌ REMOVE THIS PATTERN:
<div className="bg-purple-100 border-purple-200 text-purple-800 p-4 rounded-lg">
  <p>Some explanation text...</p>
</div>

<div className="bg-blue-50 border border-blue-200 p-4 rounded">
  ℹ️ Information text here
</div>
```

**Replace with:**
```jsx
// ✅ REPLACE WITH:
<p className="text-sm text-gray-600 mb-4">
  Some explanation text...
</p>
```

**Specific files likely to have these boxes:**
- `app/dashboard/assistant/page.jsx`
- `app/dashboard/phone-numbers/page.jsx`
- `app/dashboard/integrations/page.jsx`
- `app/dashboard/knowledge/page.jsx`

**Example fix in `app/dashboard/assistant/page.jsx`:**
```jsx
// BEFORE:
<div className="bg-indigo-50 border border-indigo-200 p-4 rounded-lg mb-6">
  <p className="text-indigo-800">
    ℹ️ Asistanlarınızı buradan yönetebilir, yeni asistan oluşturabilir ve
    mevcut asistanlarınızı düzenleyebilirsiniz.
  </p>
</div>

// AFTER:
<p className="text-sm text-gray-600 mb-6">
  Asistanlarınızı buradan oluşturup yönetin
</p>
```

---

### Task 1.4: Update Navigation Structure and Terminology

**File: `components/Sidebar.jsx`**

**Current structure (approximately):**
```jsx
const menuItems = [
  { name: 'Dashboard', icon: Home, href: '/dashboard' },
  { name: 'Asistanlar', icon: Bot, href: '/dashboard/assistant' },
  { name: 'Bilgi Bankası', icon: Book, href: '/dashboard/knowledge' },
  { name: 'Gelen Arama', icon: Phone, href: '/dashboard/calls' },
  { name: 'Giden Arama', icon: PhoneOutgoing, href: '/dashboard/batch-calls' },
  { name: 'Telefon Numaraları', icon: Hash, href: '/dashboard/phone-numbers' },
  // ... etc
]
```

**NEW structure:**
```jsx
const menuSections = [
  {
    title: 'Oluştur',
    items: [
      {
        name: 'Asistanlar',
        icon: Bot,
        href: '/dashboard/assistant',
        badge: null
      },
      {
        name: 'Bilgi Bankası',
        icon: Database,
        href: '/dashboard/knowledge'
      },
    ]
  },
  {
    title: 'Kanallar',
    items: [
      {
        name: 'Telefon',
        icon: Phone,
        href: '/dashboard/phone',
        description: 'Numara, ayarlar, kayıtlar'
      },
      {
        name: 'WhatsApp',
        icon: MessageCircle,
        href: '/dashboard/whatsapp',
        badge: 'Yakında'
      },
      {
        name: 'E-posta',
        icon: Mail,
        href: '/dashboard/email'
      },
      {
        name: 'Web Widget',
        icon: MessageSquare,
        href: '/dashboard/chat-widget'
      },
    ]
  },
  {
    title: 'Veri Merkezi',
    items: [
      {
        name: 'Gelen Talepler',  // ← CHANGED from "Gelen Arama"
        icon: Inbox,
        href: '/dashboard/calls',
        description: 'Müşteri konuşmaları'
      },
      {
        name: 'Kampanyalar',  // ← CHANGED from "Giden Arama"
        icon: Megaphone,
        href: '/dashboard/campaigns',  // ← NEW route
        description: 'Toplu arama kampanyaları'
      },
    ]
  },
  {
    title: 'Analitik',
    items: [
      {
        name: 'Genel Bakış',
        icon: BarChart,
        href: '/dashboard/analytics'
      },
    ]
  },
  {
    title: 'Ayarlar',
    items: [
      {
        name: 'Entegrasyonlar',
        icon: Plug,
        href: '/dashboard/integrations'
      },
      {
        name: 'Ekip',
        icon: Users,
        href: '/dashboard/team'
      },
      {
        name: 'Abonelik',
        icon: CreditCard,
        href: '/dashboard/subscription'
      },
      {
        name: 'Hesap',
        icon: Settings,
        href: '/dashboard/settings'
      },
    ]
  },
]

// Render with sections
<nav className="space-y-6">
  {menuSections.map((section) => (
    <div key={section.title}>
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-3">
        {section.title}
      </h3>
      <div className="space-y-1">
        {section.items.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm',
              'hover:bg-gray-100 transition-colors',
              pathname === item.href
                ? 'bg-primary-50 text-primary-700 font-medium'
                : 'text-gray-700'
            )}
          >
            <item.icon className="w-5 h-5" />
            <span className="flex-1">{item.name}</span>
            {item.badge && (
              <span className="text-xs px-2 py-0.5 rounded bg-accent-50 text-accent-700">
                {item.badge}
              </span>
            )}
          </Link>
        ))}
      </div>
    </div>
  ))}
</nav>
```

**Translation files to update:**

**File: `locales/tr/common.json`**
```json
{
  "nav": {
    "create": "Oluştur",
    "assistants": "Asistanlar",
    "knowledge": "Bilgi Bankası",
    "channels": "Kanallar",
    "phone": "Telefon",
    "whatsapp": "WhatsApp",
    "email": "E-posta",
    "webWidget": "Web Widget",
    "dataCenter": "Veri Merkezi",
    "inboundRequests": "Gelen Talepler",
    "campaigns": "Kampanyalar",
    "analytics": "Analitik",
    "settings": "Ayarlar",
    "integrations": "Entegrasyonlar",
    "team": "Ekip",
    "subscription": "Abonelik"
  }
}
```

---

### Task 1.5: Rename Routes

**Rename folder:**
```bash
# Rename batch-calls to campaigns
mv app/dashboard/batch-calls app/dashboard/campaigns

# Update all internal references
grep -r "batch-calls" app/ | # find all references
sed -i '' 's/batch-calls/campaigns/g' # replace
```

**Add redirect for old URL:**

**File: `next.config.js`**
```js
module.exports = {
  async redirects() {
    return [
      {
        source: '/dashboard/batch-calls',
        destination: '/dashboard/campaigns',
        permanent: true,
      },
      {
        source: '/dashboard/phone-numbers',
        destination: '/dashboard/phone',
        permanent: true,
      },
    ]
  },
}
```

---

### Task 1.6: Redesign Integrations Page

**File: `app/dashboard/integrations/page.jsx`**

**NEW implementation:**
```jsx
'use client'

import { useState } from 'react'
import { Search } from 'lucide-react'

const categories = [
  { id: 'all', label: 'Tümü' },
  { id: 'crm', label: 'CRM' },
  { id: 'email', label: 'E-posta' },
  { id: 'calendar', label: 'Takvim' },
  { id: 'ecommerce', label: 'E-ticaret' },
]

const integrations = [
  {
    id: 'gmail',
    name: 'Gmail',
    icon: '/integrations/gmail.svg',
    description: 'E-postalarınızı senkronize edin ve asistanınızın yanıt vermesini sağlayın',
    category: 'email',
    isConnected: true,
    isPro: true,
  },
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    icon: '/integrations/calendar.svg',
    description: 'Randevularınızı yönetin ve otomatik hatırlatmalar gönderin',
    category: 'calendar',
    isConnected: false,
    isPro: false,
  },
  {
    id: 'shopify',
    name: 'Shopify',
    icon: '/integrations/shopify.svg',
    description: 'Siparişlerinizi takip edin ve müşterilere otomatik bildirimler gönderin',
    category: 'ecommerce',
    isConnected: false,
    isPro: true,
  },
  // ... more integrations
]

export default function IntegrationsPage() {
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  const filteredIntegrations = integrations.filter((integration) => {
    const matchesCategory = selectedCategory === 'all' || integration.category === selectedCategory
    const matchesSearch = integration.name.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Entegrasyonlar
        </h1>
        <p className="text-sm text-gray-600">
          Platformlarınızı bağlayarak asistanlarınızı güçlendirin
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        {/* Category Filter */}
        <div className="flex gap-2 flex-wrap">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                selectedCategory === category.id
                  ? 'bg-primary-500 text-white'
                  : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
              )}
            >
              {category.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-xs ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Entegrasyon ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-500"
          />
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredIntegrations.map((integration) => (
          <IntegrationCard key={integration.id} integration={integration} />
        ))}
      </div>

      {/* Empty State */}
      {filteredIntegrations.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <Search className="w-6 h-6 text-gray-400" />
          </div>
          <h3 className="text-base font-semibold text-gray-900 mb-2">
            Entegrasyon bulunamadı
          </h3>
          <p className="text-sm text-gray-600 text-center max-w-sm">
            "{searchQuery}" araması için sonuç bulunamadı. Farklı bir arama terimi deneyin.
          </p>
        </div>
      )}
    </div>
  )
}

function IntegrationCard({ integration }) {
  const { name, icon, description, isConnected, isPro } = integration

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow h-[220px] flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
          <img src={icon} alt={name} className="w-6 h-6" />
        </div>
        {isPro && (
          <span className="px-2 py-1 bg-accent-50 text-accent-700 border border-accent-200 text-xs font-medium rounded-md">
            PRO
          </span>
        )}
      </div>

      {/* Name */}
      <h3 className="text-base font-semibold text-gray-900 mb-2">
        {name}
      </h3>

      {/* Description (2 lines max) */}
      <p className="text-sm text-gray-600 mb-4 flex-1 line-clamp-2">
        {description}
      </p>

      {/* Footer */}
      {isConnected ? (
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
            <CheckCircle className="w-4 h-4" />
            Bağlı
          </span>
          <button className="text-sm text-gray-600 hover:text-gray-900 font-medium">
            Yönet
          </button>
        </div>
      ) : (
        <button className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-900 rounded-lg text-sm font-medium transition-colors">
          Bağla
        </button>
      )}
    </div>
  )
}
```

**Key CSS utilities needed:**
```css
/* Add to globals.css if not already present */
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
```

---

## Sprint 2: Assistants + Phone Merge (Days 4-6)

### Task 2.1: Redesign Assistants Page

**File: `app/dashboard/assistant/page.jsx`**

```jsx
'use client'

import { useState } from 'react'
import { Bot, Plus, Grid, List } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function AssistantsPage() {
  const [viewMode, setViewMode] = useState('list') // 'list' or 'grid'
  const [assistants, setAssistants] = useState([
    {
      id: '1',
      name: 'Satış Asistanı',
      type: 'inbound',
      status: 'active',
      createdAt: '2 gün önce',
    },
    {
      id: '2',
      name: 'Destek Bot',
      type: 'inbound',
      status: 'active',
      createdAt: '5 gün önce',
    },
  ])

  const plan = 'PRO' // Get from user context
  const limit = 5
  const used = assistants.length

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Asistanlar
          </h1>
          <p className="text-sm text-gray-600">
            Asistanlarınızı buradan oluşturup yönetin
          </p>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Yeni Asistan
        </Button>
      </div>

      {/* Limit Badge */}
      <div className="flex items-center justify-between mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <span className="text-sm text-gray-700">
          <span className="font-semibold">{used}/{limit}</span> asistan kullanılıyor
        </span>
        <span className="px-2 py-1 bg-accent-50 text-accent-700 text-xs font-medium rounded-md border border-accent-200">
          {plan}
        </span>
      </div>

      {/* View Toggle */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setViewMode('list')}
          className={cn(
            'px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2',
            viewMode === 'list'
              ? 'bg-white border border-gray-200 text-gray-900'
              : 'text-gray-600 hover:bg-gray-50'
          )}
        >
          <List className="w-4 h-4" />
          Liste
        </button>
        <button
          onClick={() => setViewMode('grid')}
          className={cn(
            'px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2',
            viewMode === 'grid'
              ? 'bg-white border border-gray-200 text-gray-900'
              : 'text-gray-600 hover:bg-gray-50'
          )}
        >
          <Grid className="w-4 h-4" />
          Kartlar
        </button>
      </div>

      {/* List View */}
      {viewMode === 'list' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                  İsim
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                  Tür
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                  Durum
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                  Oluşturulma
                </th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {assistants.map((assistant) => (
                <tr key={assistant.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center">
                        <Bot className="w-4 h-4 text-primary-600" />
                      </div>
                      <span className="text-sm font-medium text-gray-900">
                        {assistant.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-md">
                      {assistant.type === 'inbound' ? 'Inbound' : 'Outbound'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      'px-2 py-1 text-xs font-medium rounded-md',
                      assistant.status === 'active'
                        ? 'bg-green-50 text-green-700 border border-green-200'
                        : 'bg-gray-100 text-gray-700'
                    )}>
                      {assistant.status === 'active' ? '🟢 Aktif' : '🔴 Pasif'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-600">
                      {assistant.createdAt}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-gray-400 hover:text-gray-600">
                      <MoreVertical className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Card View */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {assistants.map((assistant) => (
            <AssistantCard key={assistant.id} assistant={assistant} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {assistants.length === 0 && (
        <EmptyState
          icon={Bot}
          title="Henüz asistan oluşturmadınız"
          description="İlk asistanınızı oluşturarak müşteri hizmetlerinizi otomatikleştirmeye başlayın"
          ctaText="İlk Asistanı Oluştur"
          onCta={() => {}}
        />
      )}
    </div>
  )
}
```

---

### Task 2.2: Phone Page Tab Merge

**Step 1: Create new Phone page with tabs**

**File: `app/dashboard/phone/page.jsx`**

```jsx
'use client'

import { useState } from 'react'
import { Phone, Settings, History } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function PhonePage() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Telefon
        </h1>
        <p className="text-sm text-gray-600">
          Telefon numaralarınızı bağlayın ve aramalarınızı yönetin
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="numbers" className="space-y-6">
        <TabsList className="border-b border-gray-200">
          <TabsTrigger value="numbers" className="gap-2">
            <Phone className="w-4 h-4" />
            Numaralar
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2">
            <Settings className="w-4 h-4" />
            Ayarlar
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-2">
            <History className="w-4 h-4" />
            Kayıtlar
          </TabsTrigger>
        </TabsList>

        {/* Tab: Numbers */}
        <TabsContent value="numbers">
          <NumbersTab />
        </TabsContent>

        {/* Tab: Settings */}
        <TabsContent value="settings">
          <SettingsTab />
        </TabsContent>

        {/* Tab: Logs */}
        <TabsContent value="logs">
          <LogsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function NumbersTab() {
  const plan = 'STARTER'
  const limit = 1
  const used = 1
  const numbers = [
    {
      id: '1',
      number: '+90 532 123 45 67',
      label: 'Satış Hattı',
      status: 'active',
      assistant: 'Satış Asistanı',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Limit Display */}
      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
        <span className="text-sm text-gray-700">
          Bağlı Numaralar <span className="font-semibold">({used}/{limit})</span>
        </span>
        <span className="px-2 py-1 bg-accent-50 text-accent-700 text-xs font-medium rounded-md border border-accent-200">
          {plan}
        </span>
      </div>

      {/* Numbers List */}
      <div className="space-y-3">
        {numbers.map((number) => (
          <div key={number.id} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <Phone className="w-5 h-5 text-gray-400" />
                  <span className="text-base font-semibold text-gray-900">
                    {number.number}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-2">
                  {number.label}
                </p>
                <div className="flex items-center gap-4 text-sm">
                  <span className="flex items-center gap-1 text-green-600">
                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                    Aktif
                  </span>
                  <span className="text-gray-600">
                    {number.assistant} atandı
                  </span>
                </div>
              </div>
              <button className="text-gray-400 hover:text-gray-600">
                <MoreVertical className="w-5 h-5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add Number Button */}
      <Button
        variant="outline"
        className="w-full"
        disabled={used >= limit}
      >
        <Plus className="w-4 h-4 mr-2" />
        Numara Ekle
      </Button>

      {/* Limit Warning */}
      {used >= limit && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-amber-900 mb-1">
              {plan} planınızda {limit} numara bağlayabilirsiniz
            </h4>
            <p className="text-sm text-amber-700">
              Daha fazla numara için planınızı yükseltin
            </p>
          </div>
          <Button variant="warning" size="sm">
            Planı Yükselt
          </Button>
        </div>
      )}
    </div>
  )
}

function SettingsTab() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-base font-semibold text-gray-900 mb-4">
        Mesai Saatleri
      </h3>
      <p className="text-sm text-gray-600">
        Yakında eklenecek...
      </p>
    </div>
  )
}

function LogsTab() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-base font-semibold text-gray-900 mb-4">
        Arama Kayıtları
      </h3>
      <p className="text-sm text-gray-600">
        Yakında eklenecek...
      </p>
    </div>
  )
}
```

**Step 2: Remove old phone-numbers page**
```bash
# Delete the old phone-numbers folder
rm -rf app/dashboard/phone-numbers
```

---

## Sprint 3: Settings + Polish (Days 7-9)

### Task 3.1: Settings 2-Column Layout

**File: `app/dashboard/settings/page.jsx`**

```jsx
export default function SettingsPage() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Ayarlar
        </h1>
        <p className="text-sm text-gray-600">
          Hesap ve profil ayarlarınızı yönetin
        </p>
      </div>

      {/* 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Profile Card */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-base font-semibold text-gray-900 mb-4">
              Profil Bilgileri
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-900">Ad Soyad</label>
                <input type="text" className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-900">E-posta</label>
                <input type="email" className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-900">Telefon</label>
                <input type="tel" className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              </div>
            </div>
            <div className="flex justify-end mt-4 pt-4 border-t border-gray-100">
              <Button size="sm">Kaydet</Button>
            </div>
          </div>

          {/* Region Card */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-base font-semibold text-gray-900 mb-4">
              Bölge Ayarları
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-900">Saat Dilimi</label>
                <select className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                  <option>Europe/Istanbul</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-900">Dil</label>
                <select className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                  <option>Türkçe</option>
                  <option>English</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end mt-4 pt-4 border-t border-gray-100">
              <Button size="sm">Kaydet</Button>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Email Signature */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-base font-semibold text-gray-900 mb-4">
              E-posta İmzası
            </h3>
            <textarea
              rows={6}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              placeholder="E-posta imzanızı buraya yazın..."
            />
            <div className="flex justify-end mt-4 pt-4 border-t border-gray-100">
              <Button size="sm">Kaydet</Button>
            </div>
          </div>

          {/* Notifications */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-base font-semibold text-gray-900 mb-4">
              Bildirimler
            </h3>
            <div className="space-y-3">
              <label className="flex items-center justify-between">
                <span className="text-sm text-gray-700">Yeni aramalar</span>
                <Switch />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-sm text-gray-700">Haftalık rapor</span>
                <Switch />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-sm text-gray-700">Limit uyarıları</span>
                <Switch />
              </label>
            </div>
            <div className="flex justify-end mt-4 pt-4 border-t border-gray-100">
              <Button size="sm">Kaydet</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
```

---

### Task 3.2: Create Reusable Empty State Component

**File: `components/EmptyState.jsx`**

```jsx
import { Button } from './ui/button'

export function EmptyState({
  icon: Icon,
  title,
  description,
  ctaText,
  onCta,
  secondaryText,
  onSecondary,
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      {/* Icon */}
      <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4">
        <Icon className="w-7 h-7 text-gray-400" />
      </div>

      {/* Title */}
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        {title}
      </h3>

      {/* Description */}
      <p className="text-sm text-gray-600 text-center max-w-md mb-6">
        {description}
      </p>

      {/* Primary CTA */}
      {ctaText && (
        <Button onClick={onCta}>
          {ctaText}
        </Button>
      )}

      {/* Secondary Action */}
      {secondaryText && (
        <button
          onClick={onSecondary}
          className="mt-3 text-sm text-gray-600 hover:text-gray-900"
        >
          {secondaryText}
        </button>
      )}
    </div>
  )
}
```

**Usage:**
```jsx
import { EmptyState } from '@/components/EmptyState'
import { Bot } from 'lucide-react'

<EmptyState
  icon={Bot}
  title="Henüz asistan oluşturmadınız"
  description="İlk asistanınızı oluşturarak müşteri hizmetlerinizi otomatikleştirmeye başlayın"
  ctaText="İlk Asistanı Oluştur"
  onCta={() => router.push('/dashboard/assistant/new')}
  secondaryText="Nasıl çalışır?"
  onSecondary={() => {}}
/>
```

---

### Task 3.3: Create Skeleton Components

**File: `components/Skeletons.jsx`** (update existing)

```jsx
export function ListSkeleton({ count = 4 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-gray-200" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-1/3" />
              <div className="h-3 bg-gray-200 rounded w-1/2" />
            </div>
            <div className="h-8 w-20 bg-gray-200 rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function CardGridSkeleton({ count = 6 }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse h-[220px]">
          <div className="w-10 h-10 bg-gray-200 rounded-lg mb-4" />
          <div className="h-4 bg-gray-200 rounded w-2/3 mb-2" />
          <div className="h-3 bg-gray-200 rounded w-full mb-1" />
          <div className="h-3 bg-gray-200 rounded w-4/5 mb-4" />
          <div className="h-9 bg-gray-200 rounded w-full mt-auto" />
        </div>
      ))}
    </div>
  )
}

export function TableSkeleton({ rows = 5, cols = 5 }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="bg-gray-50 border-b border-gray-200 p-4">
        <div className="flex gap-4">
          {Array.from({ length: cols }).map((_, i) => (
            <div key={i} className="h-3 bg-gray-200 rounded flex-1 animate-pulse" />
          ))}
        </div>
      </div>
      <div className="divide-y divide-gray-200">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="p-4">
            <div className="flex gap-4 animate-pulse">
              {Array.from({ length: cols }).map((_, j) => (
                <div key={j} className="h-4 bg-gray-200 rounded flex-1" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

**Usage:**
```jsx
import { ListSkeleton, CardGridSkeleton } from '@/components/Skeletons'

{isLoading ? (
  <CardGridSkeleton count={6} />
) : (
  <div className="grid grid-cols-3 gap-6">
    {/* actual content */}
  </div>
)}
```

---

## Final Verification Checklist

```bash
# Run this checklist before considering done:

□ Typography
  □ Plus Jakarta Sans loaded
  □ Type scale consistent (12/13/14/16/18/32)
  □ Font weights limited to 400/500/600/700
  □ No random font sizes in codebase

□ Colors
  □ Primary indigo used for all CTAs
  □ Accent cyan only for badges/highlights
  □ All description text uses gray-600
  □ No purple/blue background boxes remain

□ Navigation
  □ "Gelen Talepler" renamed
  □ "Kampanyalar" renamed
  □ "Telefon Numaraları" removed from menu
  □ Menu grouped into sections

□ Pages
  □ Assistants has limit badge + list view
  □ Integrations has filters + 3-col grid
  □ Phone has tabs (Numbers, Settings, Logs)
  □ Settings uses 2-column layout

□ Components
  □ EmptyState used on all list pages
  □ Skeleton loading on all async pages
  □ Limit banners consistent styling
  □ Button variants standardized

□ Overall
  □ All pages use max-w-7xl container
  □ All cards use rounded-xl + p-6
  □ All borders use border-gray-200
  □ Professional "established SaaS" feel
```

---

## Testing Commands

```bash
# Build and check for errors
npm run build

# Run dev server
npm run dev

# Check for unused CSS (optional)
npm run analyze

# Test dark mode
# (Switch theme toggle and verify all pages)

# Test responsive
# (Resize browser: mobile 375px, tablet 768px, desktop 1280px)
```

---

## Rollback Plan

If anything breaks:

```bash
# Revert git changes
git log --oneline  # find commit before changes
git revert <commit-hash>

# Or reset to specific commit
git reset --hard <commit-hash>

# Restore specific file
git checkout HEAD~1 -- path/to/file
```

---

This guide provides concrete implementation steps. Follow Sprint 1 → Sprint 2 → Sprint 3 in order, testing after each major change.
