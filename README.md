# 🚀 AI Assistant SaaS - Unified Project

> **Merged from Phase 1 & Phase 2 with Simplified Calendar System**
> Complete SaaS platform for AI-powered business assistants with appointment scheduling, inventory management, and more.

## 📋 Tech Stack

**Backend:**
- Node.js + Express.js
- PostgreSQL database
- Prisma ORM
- JWT authentication
- RESTful API

**Frontend:**
- Next.js 14 (App Router)
- React
- Tailwind CSS
- Multi-language support (EN/TR)

## ✨ Features

### Core Features
- ✅ **Authentication & Authorization** - JWT-based auth with role management (OWNER, ADMIN, MEMBER)
- ✅ **Business Management** - Multi-business support with data isolation
- ✅ **AI Assistant Configuration** - Voice, tone, speed, pitch customization
- ✅ **Call Logs** - Track and manage all assistant calls
- ✅ **Subscription Management** - Multiple tiers (FREE, BASIC, PRO, ENTERPRISE)

### Simplified Calendar System
- ✅ **Business Hours Management** - Set hours for each day of the week
- ✅ **Appointment Booking** - Direct database appointments (no external integration)
- ✅ **Availability Checking** - Smart slot generation with buffer times
- ✅ **No OAuth Complexity** - Simple, customer-friendly system

### Inventory & Shipping
- ✅ **Product Management** - SKU, pricing, stock levels
- ✅ **CSV Import** - Bulk product import/update
- ✅ **Low Stock Alerts** - Automatic threshold monitoring
- ✅ **Shipping Tracking** - Track orders across multiple carriers

## 🗄️ Database Schema

### Core Models
- `User` - User accounts with role-based access
- `Business` - Business profiles with settings
- `Subscription` - Plan and payment information
- `CallLog` - VAPI call records

### Calendar Models (Simplified)
- `BusinessHours` - Operating hours per day
- `Appointment` - Direct appointments (no external calendar)

### Inventory Models
- `Product` - Product catalog
- `ShippingInfo` - Order tracking
- `InventoryLog` - Stock change history

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ installed
- PostgreSQL database (provided via Supabase)
- Yarn package manager

### Backend Setup

```bash
# Navigate to backend directory
cd /app/backend

# Install dependencies
yarn install

# Generate Prisma client
yarn prisma generate

# Run database migrations
yarn prisma migrate dev

# Start development server
yarn dev
# Server runs on http://localhost:3001
```

### Frontend Setup

```bash
# Navigate to frontend directory
cd /app/frontend

# Install dependencies
yarn install

# Start development server
yarn dev
# Frontend runs on http://localhost:3000
```

## 📁 Project Structure

```
/app/
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   │   ├── auth.js           # Authentication endpoints
│   │   │   ├── business.js       # Business management
│   │   │   ├── callLogs.js       # Call log tracking
│   │   │   ├── subscription.js   # Subscription handling
│   │   │   ├── assistant.js      # AI assistant config
│   │   │   ├── calendar.js       # Simplified calendar (NEW)
│   │   │   └── inventory.js      # Products & shipping
│   │   ├── middleware/
│   │   │   └── auth.js           # JWT authentication
│   │   └── server.js             # Express app entry
│   ├── prisma/
│   │   └── schema.prisma         # Unified database schema
│   ├── .env                      # Environment variables
│   └── package.json
│
└── frontend/
    ├── app/                      # Next.js pages (App Router)
    ├── components/               # React components
    ├── lib/                      # Utilities & helpers
    ├── .env                      # Frontend env variables
    └── package.json
```

## 🔑 Environment Variables

### Backend (.env)

```env
# Database (Already configured)
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...

# Authentication
JWT_SECRET=your-secret-key-here

# Server
PORT=3001
NODE_ENV=development

# VAPI (Optional - for real AI calls)
VAPI_API_KEY=your-vapi-key
VAPI_BASE_URL=https://api.vapi.ai
```

### Frontend (.env)

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## 🔒 Security Features

- **Business Data Isolation** - All queries filtered by businessId
- **Role-Based Access Control** - OWNER, ADMIN, MEMBER permissions
- **JWT Authentication** - Secure token-based auth
- **Password Hashing** - Bcrypt encryption
- **Input Validation** - All API endpoints validated

## 🌐 API Endpoints

### Authentication
- `POST /api/auth/register` - Create new account
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user

### Business
- `GET /api/business/:id` - Get business details
- `PUT /api/business/:id` - Update business

### Calendar (Simplified)
- `GET /api/calendar/business-hours` - Get operating hours
- `PUT /api/calendar/business-hours` - Update hours
- `GET /api/calendar/appointments` - List appointments
- `POST /api/calendar/appointments` - Book appointment
- `POST /api/calendar/availability` - Check available slots

### Assistant
- `GET /api/assistant/config` - Get AI configuration
- `PUT /api/assistant/config` - Update voice/tone settings
- `GET /api/assistant/voices` - List available voices

### Inventory
- `GET /api/inventory/products` - List products
- `POST /api/inventory/products` - Create product
- `POST /api/inventory/products/import` - CSV import
- `GET /api/inventory/shipping` - Track shipments

## 🎨 Frontend Features

- **Multi-language Support** - English & Turkish
- **Responsive Design** - Mobile-friendly UI
- **Real-time Updates** - Live data synchronization
- **Toast Notifications** - User feedback on actions
- **Loading States** - Smooth UX during API calls

## 📊 Database Management

### Prisma Commands

```bash
# Generate Prisma Client
yarn prisma generate

# Create migration
yarn prisma migrate dev --name migration_name

# Reset database
yarn prisma migrate reset

# Open Prisma Studio (GUI)
yarn prisma studio
```

## 🧪 Testing

### Backend Testing

```bash
# Test health endpoint
curl http://localhost:3001/health

# Test authentication
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

## 🚀 Production Deployment

### Backend
1. Set `NODE_ENV=production`
2. Update `DATABASE_URL` to production database
3. Set strong `JWT_SECRET`
4. Run migrations: `yarn prisma migrate deploy`

### Frontend
1. Update `NEXT_PUBLIC_API_URL` to production backend URL
2. Build: `yarn build`
3. Start: `yarn start`

## 📝 Key Improvements from Merge

### ✅ Simplified Calendar (from Merged project)
- **No Google OAuth** - Direct database appointments
- **BusinessHours Model** - Dedicated table for operating hours
- **Easy Setup** - No external credentials needed
- **Customer Friendly** - Simple to configure and use

### ✅ Enhanced Database Schema
- Better indexing for performance
- Cleaner enum definitions
- NO_SHOW status for appointments
- Improved relationships

### ✅ Security Enhancements
- businessId filter on ALL queries
- Role-based route protection
- Better error handling

## 🛠️ Troubleshooting

### Database Connection Issues
```bash
# Test database connection
yarn prisma db pull
```

### Port Already in Use
```bash
# Kill process on port 3001
lsof -ti:3001 | xargs kill -9
```

### Prisma Client Issues
```bash
# Regenerate Prisma Client
rm -rf node_modules/.prisma
yarn prisma generate
```

## 📞 Support

For issues or questions:
1. Check existing documentation
2. Review error logs
3. Contact development team

## 📄 License

Proprietary - All Rights Reserved

---

**Built with ❤️ using Node.js, Express, Next.js, and PostgreSQL**
