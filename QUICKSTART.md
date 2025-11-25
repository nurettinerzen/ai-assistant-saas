# ⚡ Quick Start Guide - AI Assistant SaaS

## 🎯 What's This Project?

A complete **AI Assistant SaaS platform** with:
- ✅ **Node.js/Express Backend** (NOT Python!)
- ✅ **Next.js 14 Frontend** with React
- ✅ **PostgreSQL Database** via Prisma ORM
- ✅ **Simplified Calendar** (No Google OAuth complexity)
- ✅ **AI Assistant Configuration**
- ✅ **Inventory & Shipping Management**

---

## 🚀 Already Running!

Both services are **LIVE** and running via supervisor:

### Backend Status
```bash
curl http://localhost:3001/health
```
**Response:** `{"status": "ok", "message": "AI Assistant SaaS Backend - Phase 2"}`

### Frontend Status
```
http://localhost:3000
```

### Check Service Status
```bash
sudo supervisorctl status
```

---

## 📁 Project Structure

```
/app/
├── backend/              # Express.js API Server
│   ├── src/
│   │   ├── routes/      # All API endpoints
│   │   ├── middleware/  # Auth & validation
│   │   └── server.js    # Main entry point
│   ├── prisma/
│   │   └── schema.prisma # Database schema
│   └── .env             # Backend config
│
└── frontend/            # Next.js 14 App
    ├── app/             # App Router pages
    ├── components/      # React components
    ├── lib/             # Utilities
    └── .env             # Frontend config
```

---

## 🔧 Common Commands

### Backend Commands
```bash
cd /app/backend

# Install dependencies
yarn install

# Generate Prisma Client
yarn prisma generate

# Run migrations
yarn prisma migrate dev

# Start dev server
yarn dev

# Open Prisma Studio (Database GUI)
yarn prisma studio
```

### Frontend Commands
```bash
cd /app/frontend

# Install dependencies
yarn install

# Start dev server
yarn dev

# Build for production
yarn build

# Start production server
yarn start
```

### Supervisor Commands
```bash
# Restart all services
sudo supervisorctl restart all

# Restart backend only
sudo supervisorctl restart backend

# Restart frontend only
sudo supervisorctl restart frontend

# Check status
sudo supervisorctl status

# View logs
tail -f /var/log/supervisor/backend.out.log
tail -f /var/log/supervisor/frontend.out.log
```

---

## 📋 API Endpoints Summary

### Authentication
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user

### Simplified Calendar (No OAuth!)
- `GET /api/calendar/business-hours` - Get operating hours
- `PUT /api/calendar/business-hours` - Update hours
- `GET /api/calendar/appointments` - List appointments
- `POST /api/calendar/appointments` - Book appointment
- `POST /api/calendar/availability` - Check available slots

### AI Assistant
- `GET /api/assistant/config` - Get voice/tone settings
- `PUT /api/assistant/config` - Update settings
- `GET /api/assistant/voices` - List available voices

### Inventory
- `GET /api/inventory/products` - List products
- `POST /api/inventory/products` - Create product
- `POST /api/inventory/products/import` - CSV import
- `GET /api/inventory/shipping` - Track shipments

**Full API docs:** `/app/API_DOCUMENTATION.md`

---

## 🗄️ Database Models

### Core Models
- **User** - Authentication & roles
- **Business** - Business profiles
- **Subscription** - Plans & billing
- **CallLog** - VAPI call records

### Simplified Calendar (NEW!)
- **BusinessHours** - Operating hours per day (JSON)
- **Appointment** - Direct database appointments

### Inventory
- **Product** - Product catalog with SKU
- **ShippingInfo** - Order tracking
- **InventoryLog** - Stock changes

---

## 🔐 Environment Variables

### Backend (.env)
```env
# Database (Already configured)
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...

# Auth
JWT_SECRET=super-secret-change-this-12345

# Server
PORT=3001
NODE_ENV=development
```

### Frontend (.env)
```env
# Backend URL (Already configured)
REACT_APP_BACKEND_URL=https://your-preview-url.com

# Other settings
WDS_SOCKET_PORT=443
```

---

## 🧪 Quick Tests

### 1. Test Backend Health
```bash
curl http://localhost:3001/health
```

### 2. Register a User
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "businessName": "Test Business",
    "role": "OWNER"
  }'
```

### 3. Login
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

Save the token from the response!

### 4. Get Business Hours (with token)
```bash
curl -X GET http://localhost:3001/api/calendar/business-hours \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

## 🎨 Frontend Pages

- `/` - Landing page
- `/login` - User login
- `/register` - Sign up
- `/dashboard` - Main dashboard
- `/dashboard/assistant` - AI configuration
- `/dashboard/calendar` - Appointment management
- `/dashboard/inventory` - Products & shipping

---

## 🔥 Key Features

### ✅ Simplified Calendar System
- **No Google OAuth complexity**
- **Direct database storage**
- **Easy JSON configuration**
- **Smart availability checking**
- **Buffer time support**

### ✅ Business Data Isolation
- Every query filtered by `businessId`
- Users can only see their own data
- Role-based access control (OWNER/ADMIN/MEMBER)

### ✅ Production Ready
- Error handling on all endpoints
- Input validation
- JWT authentication
- Password hashing (bcrypt)
- Database transactions

---

## 📝 Database Migrations

### Create a New Migration
```bash
cd /app/backend
yarn prisma migrate dev --name add_new_feature
```

### Apply Migrations
```bash
yarn prisma migrate deploy
```

### Reset Database (Development Only!)
```bash
yarn prisma migrate reset
```

---

## 🐛 Troubleshooting

### Backend Not Starting?
```bash
# Check logs
tail -50 /var/log/supervisor/backend.err.log

# Restart
sudo supervisorctl restart backend
```

### Frontend Not Starting?
```bash
# Check logs
tail -50 /var/log/supervisor/frontend.err.log

# Restart
sudo supervisorctl restart frontend
```

### Database Connection Issues?
```bash
cd /app/backend
yarn prisma db pull  # Test connection
yarn prisma generate # Regenerate client
```

### Port Already in Use?
```bash
# Check what's using port 3001
lsof -i:3001

# Kill process
kill -9 <PID>
```

---

## 📚 Documentation Files

- `README.md` - Complete project documentation
- `API_DOCUMENTATION.md` - All API endpoints
- `QUICKSTART.md` - This file!
- `backend/prisma/schema.prisma` - Database schema

---

## 🎯 Next Steps

1. **Test the APIs** - Use curl or Postman
2. **Create test accounts** - Register via `/api/auth/register`
3. **Configure business hours** - Set up calendar
4. **Add products** - Populate inventory
5. **Customize AI assistant** - Set voice/tone

---

## 💡 Tips

- **Hot Reload:** Both frontend and backend auto-restart on file changes
- **Database GUI:** Use `yarn prisma studio` to view/edit data visually
- **Multi-language:** Frontend supports EN/TR out of the box
- **Security:** Always filter queries by `businessId` in new endpoints
- **Testing:** Use curl or Postman to test APIs before frontend integration

---

## 🆘 Need Help?

1. Check the logs: `/var/log/supervisor/`
2. Review API docs: `API_DOCUMENTATION.md`
3. Check database schema: `backend/prisma/schema.prisma`
4. Test with curl commands above

---

## ✨ What Makes This Special?

### 🚀 Simplified Calendar
Unlike Phase 2's complex Google OAuth calendar integration, we have a **direct database calendar** that:
- Requires NO external credentials
- Stores everything in PostgreSQL
- Easy to configure and manage
- No customer technical setup needed

### 🎯 Best of All 3 Projects
- **Phase 1:** Strong authentication & business foundation
- **Phase 2:** All advanced features (assistant, inventory, calendar)
- **Merged:** Simplified calendar logic (converted from Python to Node.js)

### 🔒 Enterprise Security
- JWT authentication
- Role-based access
- Business data isolation
- Password hashing
- Input validation

---

**Built with ❤️ - Ready for production deployment!**
