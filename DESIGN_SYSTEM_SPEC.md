# TELYX AI — Professional SaaS Design System Specification

**Version:** 1.0
**Date:** 2026-01-27
**Status:** Ready for Review & Implementation

---

## 1. Design System Foundation

### 1.1 Typography System

**Primary Font Family:** Plus Jakarta Sans
**Weights:** 400 (Regular), 500 (Medium), 600 (Semi-Bold), 700 (Bold)

**Type Scale:**

```
Page Title (H1)
- Size: 32px (2rem)
- Weight: 700
- Line Height: 1.2
- Use: Main page headers
- Example: "Asistanlar", "Kampanyalar"

Section Title (H2)
- Size: 18px (1.125rem)
- Weight: 600
- Line Height: 1.4
- Use: Card headers, section dividers
- Example: "Aktif Asistanlar", "Bilgi Bankası Ayarları"

Subsection (H3)
- Size: 16px (1rem)
- Weight: 600
- Line Height: 1.5
- Use: Form labels, list headers
- Example: "Numara Seçimi", "Entegrasyon Durumu"

Body Text
- Size: 14px (0.875rem)
- Weight: 400
- Line Height: 1.6
- Use: Regular content, descriptions
- Example: Paragraphs, table cells

Small Text
- Size: 13px (0.8125rem)
- Weight: 400
- Line Height: 1.5
- Use: Helper text, captions
- Color: text-gray-600 (not colored!)

Caption Text
- Size: 12px (0.75rem)
- Weight: 400
- Line Height: 1.4
- Use: Timestamps, badges, metadata
- Example: "2 saat önce", "Son güncelleme"
```

**❌ Removed:**
- Colored explanation paragraphs (mor/mavi arka plan)
- Random text colors for emphasis
- Inconsistent font sizes

**✅ New Rule:**
- All helper text uses gray scale only (text-gray-600 light, text-gray-400 dark)
- Emphasis through weight, not color
- Maximum 3 weights per page (typically 400, 600, 700)

---

### 1.2 Color System

**Brand Colors:**

```css
/* Primary - Indigo (Main brand color) */
--primary-50: #eef2ff;
--primary-100: #e0e7ff;
--primary-500: #6366f1;   /* Main usage */
--primary-600: #4f46e5;   /* Hover state */
--primary-700: #4338ca;   /* Active state */

/* Accent - Cyan (Minimal usage) */
--accent-400: #22d3ee;    /* Badge highlight */
--accent-500: #06b6d4;    /* Selected state */
--accent-600: #0891b2;    /* Hover on accent */

/* Neutral Scale */
--gray-50: #f9fafb;
--gray-100: #f3f4f6;
--gray-200: #e5e7eb;      /* Borders */
--gray-300: #d1d5db;
--gray-400: #9ca3af;
--gray-500: #6b7280;
--gray-600: #4b5563;      /* Helper text */
--gray-700: #374151;
--gray-800: #1f2937;
--gray-900: #111827;      /* Text */

/* Semantic Colors */
--success: #10b981;       /* Green */
--warning: #f59e0b;       /* Amber */
--error: #ef4444;         /* Red */
--info: #3b82f6;          /* Blue */
```

**Usage Rules:**

| Color | Usage | Example |
|-------|-------|---------|
| Primary Indigo | CTAs, links, active states | "Yeni Asistan" button, selected tab |
| Accent Cyan | Badges, highlights, icons | "PRO" badge, selected item indicator |
| Gray Scale | Text, borders, backgrounds | All body text, card borders, dividers |
| Semantic | Status, feedback | Success toast, error messages, warnings |

**❌ Forbidden:**
- Random purple/blue backgrounds for text blocks
- Using accent color for entire buttons
- Mixing primary and accent in same component

**✅ Correct Pattern:**
```jsx
// Button
<button className="bg-primary-500 hover:bg-primary-600">

// Badge with accent
<span className="bg-accent-50 text-accent-700 border-accent-200">
  PRO
</span>

// Helper text (NEVER colored)
<p className="text-gray-600">
  Asistanınız müşteri sorularını yanıtlamak için buradaki verileri kullanır.
</p>
```

---

### 1.3 Spacing & Layout

**Container:**
```css
max-width: 1280px;
margin: 0 auto;
padding: 0 24px;
```

**Grid System:**
```
Columns: 12
Gap: 24px
Responsive breakpoints:
- sm: 640px
- md: 768px
- lg: 1024px
- xl: 1280px
```

**Component Spacing:**
```
Card padding: 24px (p-6)
Section gap: 32px (gap-8)
Element gap: 16px (gap-4)
List item gap: 12px (gap-3)
```

**Border Radius:**
```
Card: 12px (rounded-xl)
Button: 8px (rounded-lg)
Input: 8px (rounded-lg)
Badge: 6px (rounded-md)
Avatar: 9999px (rounded-full)
```

**Border Width:**
```
Default: 1px
Focus ring: 2px
```

**Shadow System:**
```css
/* Subtle - cards at rest */
shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);

/* Default - cards hover */
shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);

/* Elevated - modals, dropdowns */
shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1);
```

---

### 1.4 Component Standards

#### Button Variants

```jsx
// Primary (main CTAs)
<button className="
  px-4 py-2 rounded-lg
  bg-primary-500 hover:bg-primary-600
  text-white font-medium text-sm
  shadow-sm hover:shadow
  transition-all duration-200
">
  Yeni Asistan
</button>

// Secondary (supporting actions)
<button className="
  px-4 py-2 rounded-lg
  bg-gray-100 hover:bg-gray-200
  text-gray-900 font-medium text-sm
  transition-colors duration-200
">
  İptal
</button>

// Ghost (subtle actions)
<button className="
  px-4 py-2 rounded-lg
  text-gray-700 hover:bg-gray-100
  font-medium text-sm
  transition-colors duration-200
">
  Düzenle
</button>

// Danger (destructive actions)
<button className="
  px-4 py-2 rounded-lg
  bg-red-500 hover:bg-red-600
  text-white font-medium text-sm
  shadow-sm hover:shadow
  transition-all duration-200
">
  Sil
</button>
```

#### Input Fields

```jsx
<div className="space-y-2">
  <label className="text-sm font-medium text-gray-900">
    Asistan Adı
  </label>
  <input
    type="text"
    className="
      w-full px-3 py-2 rounded-lg
      border border-gray-200
      focus:border-primary-500 focus:ring-2 focus:ring-primary-100
      text-sm text-gray-900
      placeholder:text-gray-400
      transition-colors duration-200
    "
    placeholder="Örn: Satış Asistanı"
  />
  <p className="text-xs text-gray-600">
    Müşterilerinizin göreceği isim
  </p>
</div>
```

#### Badges

```jsx
// Plan badge
<span className="
  inline-flex items-center gap-1 px-2 py-1 rounded-md
  bg-accent-50 text-accent-700 border border-accent-200
  text-xs font-medium
">
  PRO
</span>

// Status badge
<span className="
  inline-flex items-center gap-1 px-2 py-1 rounded-md
  bg-green-50 text-green-700 border border-green-200
  text-xs font-medium
">
  Aktif
</span>

// Type badge
<span className="
  inline-flex items-center gap-1 px-2 py-1 rounded-md
  bg-gray-100 text-gray-700
  text-xs font-medium
">
  Inbound
</span>
```

#### Empty State Pattern

```jsx
<div className="flex flex-col items-center justify-center py-12 px-4">
  {/* Icon */}
  <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
    <Icon className="w-6 h-6 text-gray-400" />
  </div>

  {/* Title */}
  <h3 className="text-base font-semibold text-gray-900 mb-2">
    Henüz asistan oluşturmadınız
  </h3>

  {/* Description */}
  <p className="text-sm text-gray-600 text-center max-w-sm mb-6">
    İlk asistanınızı oluşturarak müşteri hizmetlerinizi otomatikleştirmeye başlayın.
  </p>

  {/* CTA */}
  <button className="px-4 py-2 rounded-lg bg-primary-500 text-white">
    İlk Asistanı Oluştur
  </button>
</div>
```

#### Card Pattern

```jsx
<div className="
  bg-white rounded-xl border border-gray-200
  p-6 shadow-sm hover:shadow transition-shadow
">
  {/* Card Header */}
  <div className="flex items-start justify-between mb-4">
    <div>
      <h3 className="text-base font-semibold text-gray-900">
        Satış Asistanı
      </h3>
      <p className="text-sm text-gray-600 mt-1">
        Gelen aramaları yanıtlar
      </p>
    </div>
    <span className="bg-green-50 text-green-700 px-2 py-1 rounded-md text-xs font-medium">
      Aktif
    </span>
  </div>

  {/* Card Content */}
  <div className="space-y-3">
    {/* Content here */}
  </div>

  {/* Card Footer */}
  <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
    <button className="flex-1 px-3 py-2 text-sm">Düzenle</button>
    <button className="flex-1 px-3 py-2 text-sm">Sil</button>
  </div>
</div>
```

---

## 2. Navigation & Information Architecture

### 2.1 Menu Structure Redesign

**Current Issues:**
- "Gelen Arama" unclear purpose
- "Giden Arama" sounds like phone logs, not campaigns
- Too many top-level items
- Phone Numbers feels like setup screen

**New Structure:**

```
Dashboard (Ana Sayfa)
├── Oluştur
│   ├── Asistanlar
│   ├── Bilgi Bankası
│
├── Kanallar
│   ├── Telefon
│   ├── WhatsApp
│   ├── E-posta
│   ├── Web Widget
│
├── Veri Merkezi
│   ├── Gelen Talepler      [WAS: Gelen Arama]
│   └── Kampanyalar         [WAS: Giden Arama]
│
├── Analitik
│
├── Ayarlar
│   ├── Entegrasyonlar
│   ├── Ekip
│   └── Abonelik
```

### 2.2 Terminology Changes

| Old Name | New Name | Rationale |
|----------|----------|-----------|
| Gelen Arama | Gelen Talepler | "Talepler" implies customer requests across all channels (calls, chats, emails) |
| Giden Arama | Kampanyalar | "Kampanyalar" clearly indicates proactive outreach campaigns |
| Telefon Numaraları | [Merged into Telefon] | No longer standalone page, becomes tab in Phone |
| Müşteri Verileri | [Merged into Gelen Talepler] | Data belongs with requests |

### 2.3 Page Descriptions (Microcopy)

**Gelen Talepler:**
```
Heading: Gelen Talepler
Description: Müşterilerden gelen konuşmalar ve kayıtlar. Asistanlarınız yanıt vermek için buradaki verileri kullanır.
```

**Kampanyalar:**
```
Heading: Kampanyalar
Description: Toplu arama, satış ve hatırlatma kampanyalarınızı buradan oluşturun ve yönetin.
```

**Telefon:**
```
Heading: Telefon
Description: Telefon numaralarınızı bağlayın ve gelen/giden aramalarınızı yönetin.
Tabs:
  1. Numaralar — Bağlı telefon numaraları
  2. Ayarlar — Mesai saatleri ve yönlendirme kuralları
  3. Kayıtlar — Arama geçmişi ve kayıtları
```

---

## 3. Page-by-Page Redesign Specifications

### 3.1 Asistanlar Page

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│ Page Header                                          │
│ ┌─────────────────────────────────────────────────┐ │
│ │ Asistanlar                    [Yeni Asistan] 🔵│ │
│ │ Asistanlarınızı buradan oluşturup yönetin        │ │
│ │                                                   │ │
│ │ 2/5 asistan kullanılıyor                  🏷 PRO│ │
│ └─────────────────────────────────────────────────┘ │
│                                                      │
│ View Toggle: [📋 Liste] [🎴 Kartlar]                │
│                                                      │
│ List View:                                           │
│ ┌─────────────────────────────────────────────────┐ │
│ │ İsim            Tür      Durum    Oluşturuldu   │ │
│ ├─────────────────────────────────────────────────┤ │
│ │ Satış Asistanı  Inbound  🟢 Aktif  2 gün önce   │ │
│ │ Destek Bot      Inbound  🟢 Aktif  5 gün önce   │ │
│ │ Tahsilat        Outbound 🔴 Pasif  1 hafta önce │ │
│ └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

**Key Changes:**
- Limit display: "2/5 asistan kullanılıyor" badge in header
- Toggle between List and Card view
- Table-like list with sortable columns
- Type badge (Inbound/Outbound) with neutral colors
- Status badge (Aktif/Pasif) with semantic colors
- Actions menu (⋮) for edit/delete
- Empty state when no assistants

**Component Breakdown:**
```jsx
// Header Section
<div className="flex items-center justify-between mb-8">
  <div>
    <h1 className="text-2xl font-bold text-gray-900 mb-2">
      Asistanlar
    </h1>
    <p className="text-sm text-gray-600">
      Asistanlarınızı buradan oluşturup yönetin
    </p>
  </div>
  <button className="px-4 py-2 bg-primary-500 text-white rounded-lg">
    Yeni Asistan
  </button>
</div>

// Limit Badge
<div className="flex items-center justify-between mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
  <span className="text-sm text-gray-700">
    <span className="font-semibold">2/5</span> asistan kullanılıyor
  </span>
  <span className="px-2 py-1 bg-accent-50 text-accent-700 text-xs font-medium rounded-md">
    PRO
  </span>
</div>

// View Toggle
<div className="flex gap-2 mb-4">
  <button className="px-3 py-2 bg-white border border-gray-200 rounded-lg">
    📋 Liste
  </button>
  <button className="px-3 py-2 text-gray-600 hover:bg-gray-50 rounded-lg">
    🎴 Kartlar
  </button>
</div>
```

---

### 3.2 Entegrasyonlar Page

**Current Issues:**
- Cards are huge and inconsistent
- "Pro" labels take too much space
- No filtering/search
- Feels like a dump, not a marketplace

**New Layout:**
```
┌─────────────────────────────────────────────────────┐
│ Entegrasyonlar                                       │
│ Platformlarınızı bağlayarak asistanlarınızı          │
│ güçlendirin                                          │
│                                                      │
│ Filter: [Tümü] [CRM] [E-posta] [Takvim] [E-ticaret]│
│ Search: [🔍 Entegrasyon ara...]                     │
│                                                      │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │
│ │ 📧 Gmail    │ │ 📅 Google   │ │ 🛒 Shopify  │   │
│ │             │ │   Calendar  │ │             │   │
│ │ E-postaları │ │ Randevuları │ │ Siparişleri │   │
│ │ senkronize  │ │ yönetin    │ │ takip edin │   │
│ │   edin     │ │            │ │            │   │
│ │             │ │             │ │    🏷 PRO   │   │
│ │ 🟢 Bağlı   │ │ [Bağla]    │ │ [Bağla]    │   │
│ └─────────────┘ └─────────────┘ └─────────────┘   │
└─────────────────────────────────────────────────────┘
```

**Card Pattern:**
```jsx
<div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow">
  {/* Logo & Badge */}
  <div className="flex items-start justify-between mb-4">
    <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
      <img src="/integrations/gmail.svg" alt="Gmail" className="w-6 h-6" />
    </div>
    {isPro && (
      <span className="px-2 py-1 bg-accent-50 text-accent-700 text-xs font-medium rounded-md">
        PRO
      </span>
    )}
  </div>

  {/* Name */}
  <h3 className="text-base font-semibold text-gray-900 mb-2">
    Gmail
  </h3>

  {/* Description */}
  <p className="text-sm text-gray-600 mb-4">
    E-postalarınızı senkronize edin ve asistanınızın yanıt vermesini sağlayın
  </p>

  {/* Status or CTA */}
  {isConnected ? (
    <div className="flex items-center gap-2">
      <span className="flex items-center gap-1 text-sm text-green-600 font-medium">
        <CheckCircle className="w-4 h-4" />
        Bağlı
      </span>
      <button className="ml-auto text-sm text-gray-600 hover:text-gray-900">
        Yönet
      </button>
    </div>
  ) : (
    <button className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-900 rounded-lg text-sm font-medium">
      Bağla
    </button>
  )}
</div>
```

**Key Changes:**
- 3-column grid (responsive: 1 col mobile, 2 col tablet, 3 col desktop)
- Consistent card height: 220px
- Pro badge small and corner-positioned
- Filter buttons at top (active state with primary color)
- Connected status with icon, not full-width badge
- Description limited to 2 lines (truncate)
- Empty state for search with no results

---

### 3.3 Telefon Page (with merged Phone Numbers)

**New Tab Structure:**
```
┌─────────────────────────────────────────────────────┐
│ Telefon                                              │
│ Telefon numaralarınızı bağlayın ve aramalarınızı    │
│ yönetin                                              │
│                                                      │
│ Tabs: [Numaralar] [Ayarlar] [Kayıtlar]             │
│                                                      │
│ ┌─────────────────────────────────────────────────┐ │
│ │ TAB 1: Numaralar                                 │ │
│ │                                                   │ │
│ │ Bağlı Numaralar (1/1) 🏷 STARTER                │ │
│ │                                                   │ │
│ │ ┌─────────────────────────────────────────────┐ │ │
│ │ │ +90 532 123 45 67                            │ │ │
│ │ │ Satış Hattı                                   │ │ │
│ │ │ 🟢 Aktif • Satış Asistanı atandı            │ │ │
│ │ │                               [⋮ Yönet]      │ │ │
│ │ └─────────────────────────────────────────────┘ │ │
│ │                                                   │ │
│ │ [+ Numara Ekle] (disabled if limit reached)     │ │
│ │                                                   │ │
│ │ Limit Banner (if reached):                       │ │
│ │ ⚠️ STARTER planınızda 1 numara bağlayabilirsiniz│ │
│ │    Daha fazla numara için planınızı yükseltin   │ │
│ │    [Planı Yükselt]                              │ │
│ └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

**Key Changes:**
- Phone Numbers page completely removed from menu
- Merged into Phone page as first tab
- Limit display: "1/1 numara bağlı" with plan badge
- Each number shows: number, label, status, assigned assistant
- "Add Number" wizard opens in modal/drawer (not separate page)
- Limit warning banner (not obtrusive, dismissible)
- Settings tab for future: business hours, forwarding rules
- Logs tab: call history table

**Setup Wizard (Modal):**
```jsx
// When clicking "+ Numara Ekle"
<Modal>
  <Steps>
    {/* Step 1: Choose Provider */}
    <Step title="Operatör Seçin">
      <RadioGroup>
        <Option value="vapi">VAPI</Option>
        <Option value="elevenlabs">ElevenLabs</Option>
      </RadioGroup>
    </Step>

    {/* Step 2: Enter Details */}
    <Step title="Numara Bilgileri">
      <Input label="Telefon Numarası" />
      <Input label="Etiket" placeholder="Örn: Satış Hattı" />
    </Step>

    {/* Step 3: Assign Assistant */}
    <Step title="Asistan Ata">
      <Select options={assistants} />
    </Step>

    {/* Step 4: Confirmation */}
    <Step title="Tamamlandı">
      <SuccessIcon />
      <Text>Numaranız başarıyla bağlandı!</Text>
    </Step>
  </Steps>
</Modal>
```

---

### 3.4 Ayarlar Page

**Current Issue:**
- Cards too large with excessive padding
- Single column wastes space
- Form feels like setup screen

**New Layout (2-column):**
```
┌───────────────────────────────────────────────┐
│ Ayarlar                                        │
│ Hesap ve profil ayarlarınızı yönetin         │
│                                                │
│ Left Column          │ Right Column           │
│ ┌──────────────────┐ │ ┌──────────────────┐  │
│ │ Profil Bilgileri  │ │ │ E-posta İmzası    │  │
│ │                   │ │ │                   │  │
│ │ [Form fields]     │ │ │ [Textarea]        │  │
│ │                   │ │ │                   │  │
│ │ [Kaydet]          │ │ │ [Kaydet]          │  │
│ └──────────────────┘ │ └──────────────────┘  │
│                      │                        │
│ ┌──────────────────┐ │ ┌──────────────────┐  │
│ │ Bölge Ayarları   │ │ │ Bildirimler       │  │
│ │                   │ │ │                   │  │
│ │ [Selects]         │ │ │ [Toggles]         │  │
│ │                   │ │ │                   │  │
│ │ [Kaydet]          │ │ │                   │  │
│ └──────────────────┘ │ └──────────────────┘  │
└───────────────────────────────────────────────┘
```

**Card Specifications:**
```jsx
// Compact card with content-based height
<div className="bg-white rounded-xl border border-gray-200 p-5">
  {/* Section Title */}
  <h3 className="text-base font-semibold text-gray-900 mb-4">
    Profil Bilgileri
  </h3>

  {/* Form Fields (tight spacing) */}
  <div className="space-y-3">
    <Input label="Ad Soyad" />
    <Input label="E-posta" type="email" />
    <Input label="Telefon" type="tel" />
  </div>

  {/* Footer with Save */}
  <div className="flex justify-end mt-4 pt-4 border-t border-gray-100">
    <button className="px-4 py-2 bg-primary-500 text-white rounded-lg text-sm">
      Kaydet
    </button>
  </div>
</div>
```

**Key Changes:**
- 2-column grid (1 col on mobile)
- Card padding reduced: 20px (was 24-32px)
- Form field spacing: 12px (was 16-20px)
- Section title smaller: 16px (was 18-20px)
- Save button in card footer, not separate
- No full-width cards (max 50% width each)

---

### 3.5 Analitik Page

**Current State:** Already good, but needs refinement

**Enhancements:**
```
┌─────────────────────────────────────────────────────┐
│ Analitik                                             │
│ Performans metrikleri ve raporlarınız               │
│                                                      │
│ Filter Bar: [📅 Son 7 gün ▼] [📊 Kanal: Tümü ▼]   │
│                                         [📥 İndir] │
│                                                      │
│ KPI Cards (4 columns):                              │
│ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌──────┐│
│ │📞 1,234   │ │✅ 89%     │ │⏱️ 3m 24s  │ │💰 $2K││
│ │Toplam     │ │Başarı     │ │Ort. Süre  │ │Gelir ││
│ │Arama      │ │Oranı      │ │           │ │      ││
│ └───────────┘ └───────────┘ └───────────┘ └──────┘│
│                                                      │
│ Charts (2 columns):                                  │
│ ┌────────────────────────┐ ┌────────────────────┐  │
│ │ 📈 Arama Hacmi Trendi  │ │ 📊 Kanal Dağılımı   │  │
│ │ [Line Chart]           │ │ [Bar Chart]         │  │
│ └────────────────────────┘ └────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

**KPI Card Pattern:**
```jsx
<div className="bg-white rounded-xl border border-gray-200 p-5">
  {/* Icon */}
  <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center mb-3">
    <PhoneIcon className="w-4 h-4 text-primary-600" />
  </div>

  {/* Value */}
  <div className="text-2xl font-bold text-gray-900 mb-1">
    1,234
  </div>

  {/* Label */}
  <div className="text-sm text-gray-600">
    Toplam Arama
  </div>

  {/* Change Indicator (optional) */}
  <div className="flex items-center gap-1 mt-2 text-xs text-green-600">
    <ArrowUpIcon className="w-3 h-3" />
    <span>+12% bu hafta</span>
  </div>
</div>
```

**Key Changes:**
- KPI cards more compact (minimal padding)
- Icons monochrome with colored background
- Charts use single primary color (not rainbow)
- Filter bar single line (date + channel + export)
- Bar chart preferred over pie (more professional)

---

## 4. Micro-interactions & Loading States

### 4.1 Empty State Pattern (Standardized)

**Applied to:** Asistanlar, Bilgi Bankası, Gelen Talepler, Kampanyalar, etc.

```jsx
<div className="flex flex-col items-center justify-center py-16 px-4">
  {/* Icon Container */}
  <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4">
    <Icon className="w-7 h-7 text-gray-400" />
  </div>

  {/* Heading */}
  <h3 className="text-lg font-semibold text-gray-900 mb-2">
    Henüz {itemType} yok
  </h3>

  {/* Description (max 2 lines) */}
  <p className="text-sm text-gray-600 text-center max-w-md mb-6">
    {description}
  </p>

  {/* Primary CTA */}
  <button className="px-4 py-2 bg-primary-500 text-white rounded-lg font-medium">
    {ctaText}
  </button>

  {/* Optional Secondary Action */}
  {secondaryAction && (
    <button className="mt-3 text-sm text-gray-600 hover:text-gray-900">
      {secondaryText}
    </button>
  )}
</div>
```

**Examples:**

```
Asistanlar:
Icon: Robot
Heading: Henüz asistan oluşturmadınız
Description: İlk asistanınızı oluşturarak müşteri hizmetlerinizi otomatikleştirmeye başlayın.
CTA: İlk Asistanı Oluştur

Gelen Talepler:
Icon: Inbox
Heading: Henüz talep kaydı yok
Description: Müşterilerinizden gelen konuşmalar burada görünecek.
CTA: Nasıl Çalışır?

Kampanyalar:
Icon: Megaphone
Heading: Henüz kampanya oluşturmadınız
Description: Toplu arama kampanyaları ile müşterilerinize ulaşın.
CTA: İlk Kampanyayı Oluştur
```

---

### 4.2 Skeleton Loading States

**List Loading:**
```jsx
<div className="space-y-3">
  {[1, 2, 3, 4].map((i) => (
    <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
      <div className="flex items-center gap-4">
        {/* Avatar skeleton */}
        <div className="w-10 h-10 rounded-full bg-gray-200" />

        {/* Content skeleton */}
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-200 rounded w-1/3" />
          <div className="h-3 bg-gray-200 rounded w-1/2" />
        </div>

        {/* Action skeleton */}
        <div className="h-8 w-20 bg-gray-200 rounded" />
      </div>
    </div>
  ))}
</div>
```

**Card Grid Loading:**
```jsx
<div className="grid grid-cols-3 gap-6">
  {[1, 2, 3, 4, 5, 6].map((i) => (
    <div key={i} className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse">
      <div className="w-10 h-10 bg-gray-200 rounded-lg mb-4" />
      <div className="h-4 bg-gray-200 rounded w-2/3 mb-2" />
      <div className="h-3 bg-gray-200 rounded w-full mb-1" />
      <div className="h-3 bg-gray-200 rounded w-4/5" />
    </div>
  ))}
</div>
```

**Button Loading State:**
```jsx
<button
  disabled
  className="px-4 py-2 bg-primary-500 text-white rounded-lg flex items-center gap-2"
>
  <Loader2 className="w-4 h-4 animate-spin" />
  Yükleniyor...
</button>
```

---

### 4.3 Limit & Upgrade Banners

**In-page Banner (when limit reached):**
```jsx
<div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3 mb-6">
  {/* Icon */}
  <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />

  {/* Content */}
  <div className="flex-1">
    <h4 className="text-sm font-semibold text-amber-900 mb-1">
      Asistan limitinize ulaştınız
    </h4>
    <p className="text-sm text-amber-700">
      {currentPlan} planınızda {limit} asistan oluşturabilirsiniz. Daha fazlası için planınızı yükseltin.
    </p>
  </div>

  {/* CTA */}
  <button className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium whitespace-nowrap">
    Planı Yükselt
  </button>
</div>
```

**Modal Upgrade Prompt (when clicking locked feature):**
```jsx
<Modal>
  {/* Icon */}
  <div className="w-12 h-12 rounded-full bg-accent-50 flex items-center justify-center mx-auto mb-4">
    <Zap className="w-6 h-6 text-accent-600" />
  </div>

  {/* Content */}
  <h3 className="text-xl font-bold text-gray-900 text-center mb-2">
    Bu özellik PRO planında
  </h3>
  <p className="text-sm text-gray-600 text-center mb-6">
    {featureName} özelliğini kullanmak için PRO planına yükseltmeniz gerekiyor.
  </p>

  {/* Plan comparison */}
  <div className="bg-gray-50 rounded-lg p-4 mb-6">
    <div className="flex items-center justify-between mb-2">
      <span className="text-sm text-gray-600">Şu anki planınız</span>
      <span className="text-sm font-semibold text-gray-900">{currentPlan}</span>
    </div>
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-600">Yükseltme sonrası</span>
      <span className="text-sm font-semibold text-primary-600">PRO</span>
    </div>
  </div>

  {/* Actions */}
  <div className="flex gap-3">
    <button className="flex-1 px-4 py-2 bg-gray-100 text-gray-900 rounded-lg">
      İptal
    </button>
    <button className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg font-medium">
      Planı Görüntüle
    </button>
  </div>
</Modal>
```

---

## 5. Implementation Checklist

### Phase 1: Foundation (Days 1-2)

**Typography:**
- [ ] Add Plus Jakarta Sans to project (Google Fonts or local)
- [ ] Update `tailwind.config.js` with new font family
- [ ] Update `globals.css` with font imports
- [ ] Replace all existing font-size classes with standardized scale
- [ ] Audit and remove any custom font sizes outside the scale

**Colors:**
- [ ] Update `tailwind.config.js` color palette
- [ ] Create CSS variables for primary/accent in `globals.css`
- [ ] Remove all purple/blue background text blocks
- [ ] Replace colored text with gray scale for descriptions
- [ ] Update button variants to use new color system

**Spacing:**
- [ ] Audit all card padding (standardize to `p-6`)
- [ ] Audit all page containers (standardize to `max-w-7xl mx-auto px-6`)
- [ ] Update border radius (standardize to `rounded-xl`)
- [ ] Update shadow usage (only `shadow-sm` and `shadow`)

---

### Phase 2: Navigation (Days 2-3)

**Menu Structure:**
- [ ] Update Sidebar component with new structure
- [ ] Rename "Gelen Arama" to "Gelen Talepler"
- [ ] Rename "Giden Arama" to "Kampanyalar"
- [ ] Add "Veri Merkezi" parent group
- [ ] Remove "Telefon Numaraları" from menu

**Routes:**
- [ ] Update route names in file system (if needed)
- [ ] Update internal links to use new names
- [ ] Add redirects from old URLs to new URLs

---

### Phase 3: Page Redesigns (Days 3-8)

**Asistanlar:**
- [ ] Add limit badge in header
- [ ] Implement list/card view toggle
- [ ] Create table-like list view
- [ ] Add empty state
- [ ] Add skeleton loading

**Entegrasyonlar:**
- [ ] Redesign card component (compact, consistent)
- [ ] Add filter buttons (Tümü, CRM, E-posta, etc.)
- [ ] Add search input
- [ ] Resize Pro badge (small corner badge)
- [ ] Add empty state for search results
- [ ] Add skeleton loading

**Telefon:**
- [ ] Create tab component (Numaralar, Ayarlar, Kayıtlar)
- [ ] Move Phone Numbers content into first tab
- [ ] Add limit banner
- [ ] Create "Add Number" modal wizard
- [ ] Add empty state
- [ ] Add skeleton loading

**Ayarlar:**
- [ ] Convert to 2-column grid
- [ ] Reduce card padding to `p-5`
- [ ] Move save buttons to card footers
- [ ] Tighten form field spacing (`space-y-3`)

**Gelen Talepler:**
- [ ] Update page title and description
- [ ] Ensure consistent layout with Asistanlar
- [ ] Add empty state
- [ ] Add skeleton loading

**Kampanyalar:**
- [ ] Update page title and description
- [ ] Ensure consistent layout
- [ ] Add empty state
- [ ] Add skeleton loading

---

### Phase 4: Components (Days 8-10)

**Empty States:**
- [ ] Create reusable EmptyState component
- [ ] Apply to all list pages
- [ ] Customize icon, heading, description, CTA for each

**Skeletons:**
- [ ] Create ListSkeleton component
- [ ] Create CardGridSkeleton component
- [ ] Apply to all async data pages

**Limit Banners:**
- [ ] Create LimitBanner component
- [ ] Create UpgradeModal component
- [ ] Integrate with plan configuration

**Buttons:**
- [ ] Audit all buttons for consistency
- [ ] Ensure loading states on async actions
- [ ] Standardize disabled states

---

## 6. Done Criteria

✅ **Visual Consistency:**
- All pages use Plus Jakarta Sans with standardized type scale
- All cards use 12px border radius and consistent padding
- All buttons follow 4 variant system (Primary, Secondary, Ghost, Danger)
- All colors follow defined palette (no random purples/blues)

✅ **Navigation:**
- Menu uses clear, product-focused terminology
- "Gelen Talepler" and "Kampanyalar" replace old names
- Phone Numbers merged into Phone page tabs

✅ **Page Quality:**
- Entegrasyonlar looks like professional marketplace
- Asistanlar has list view with limit display
- Settings uses 2-column layout with compact cards
- Every list page has empty state
- Every data page has skeleton loading

✅ **Professional Feel:**
- No colored explanation boxes remain
- Helper text uses only gray scale
- Limit warnings are clear but not obtrusive
- Microcopy is concise and product-focused
- Overall impression: "established enterprise SaaS product"

---

## 7. Visual References

**Inspiration:**
- **Retell AI:** Clean, minimal, single primary color
- **11Labs:** Professional typography, consistent spacing
- **Linear:** Excellent use of gray scale, subtle shadows
- **Stripe:** Perfect button hierarchy, form layouts

**Before → After:**

```
BEFORE (Amatör):
- 5 different font sizes on one page
- Purple/blue explanation boxes
- "Gelen Arama" ambiguous name
- Giant cards in Settings
- No empty states
- Instant content load (no skeletons)

AFTER (Profesyonel):
- 3 font sizes max per page (H1, Body, Small)
- Only gray text for descriptions
- "Gelen Talepler" clear and descriptive
- Compact 2-column Settings
- Beautiful empty states on every page
- Smooth skeleton loading
```

---

## Next Steps

1. **Review this spec** — Confirm design decisions
2. **Approve to proceed** — I'll implement Sprint 1
3. **Iterate based on feedback** — We'll refine as we build

**Estimated Timeline:**
- Sprint 1 (Foundation + Integrations): 2-3 days
- Sprint 2 (Assistants + Phone): 2-3 days
- Sprint 3 (Settings + Polish): 2 days
- **Total: ~7 days** for complete transformation

---

**Questions or Adjustments?**
Let me know if you want to modify any design decisions before implementation begins.
