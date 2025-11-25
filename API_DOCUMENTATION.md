# 📚 API Documentation - AI Assistant SaaS

## Base URL
```
Development: http://localhost:3001
Production: https://your-domain.com
```

## Authentication
Most endpoints require JWT authentication. Include the token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

---

## 🔐 Authentication Endpoints

### Register New User
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword123",
  "businessName": "My Business",
  "role": "OWNER"
}
```

**Response:**
```json
{
  "token": "jwt_token_here",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "role": "OWNER",
    "businessId": 1
  }
}
```

### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

### Get Current User
```http
GET /api/auth/me
Authorization: Bearer <token>
```

---

## 🏢 Business Endpoints

### Get Business Details
```http
GET /api/business/:id
Authorization: Bearer <token>
```

### Update Business
```http
PUT /api/business/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Updated Business Name",
  "vapiPhoneNumber": "+1234567890",
  "vapiAssistantId": "assistant_id_here"
}
```

---

## 🤖 AI Assistant Configuration

### Get Assistant Config
```http
GET /api/assistant/config
Authorization: Bearer <token>
```

**Response:**
```json
{
  "vapiVoiceId": "male-1-professional",
  "vapiVoiceGender": "MALE",
  "vapiTone": "PROFESSIONAL",
  "vapiSpeed": 1.0,
  "vapiPitch": 1.0,
  "customGreeting": "Hello! How can I help you today?",
  "customInstructions": "Be professional and helpful."
}
```

### Update Assistant Config
```http
PUT /api/assistant/config
Authorization: Bearer <token>
Content-Type: application/json

{
  "vapiVoiceId": "female-1-professional",
  "vapiVoiceGender": "FEMALE",
  "vapiTone": "FRIENDLY",
  "vapiSpeed": 1.2,
  "vapiPitch": 0.9,
  "customGreeting": "Hi there!",
  "customInstructions": "Be warm and welcoming."
}
```

### Get Available Voices
```http
GET /api/assistant/voices
Authorization: Bearer <token>
```

### Test Call
```http
POST /api/assistant/test-call
Authorization: Bearer <token>
Content-Type: application/json

{
  "phoneNumber": "+1234567890"
}
```

---

## 📅 Simplified Calendar System (No OAuth Required!)

### Get Business Hours
```http
GET /api/calendar/business-hours
Authorization: Bearer <token>
```

**Response:**
```json
{
  "id": 1,
  "businessId": 1,
  "monday": {"open": "09:00", "close": "17:00", "closed": false},
  "tuesday": {"open": "09:00", "close": "17:00", "closed": false},
  "wednesday": {"open": "09:00", "close": "17:00", "closed": false},
  "thursday": {"open": "09:00", "close": "17:00", "closed": false},
  "friday": {"open": "09:00", "close": "17:00", "closed": false},
  "saturday": {"open": "09:00", "close": "17:00", "closed": true},
  "sunday": {"open": "09:00", "close": "17:00", "closed": true}
}
```

### Update Business Hours
```http
PUT /api/calendar/business-hours
Authorization: Bearer <token>
Content-Type: application/json

{
  "monday": {"open": "08:00", "close": "18:00", "closed": false},
  "tuesday": {"open": "08:00", "close": "18:00", "closed": false}
}
```

### Update Booking Settings
```http
PUT /api/calendar/booking-settings
Authorization: Bearer <token>
Content-Type: application/json

{
  "bookingDuration": 45,  // minutes (15-240)
  "bufferTime": 10       // minutes (0-60)
}
```

### Check Availability
```http
POST /api/calendar/availability
Authorization: Bearer <token>
Content-Type: application/json

{
  "date": "2024-11-15T00:00:00Z"
}
```

**Response:**
```json
{
  "available": true,
  "date": "2024-11-15T00:00:00Z",
  "businessHours": {"open": "09:00", "close": "17:00", "closed": false},
  "slots": [
    {
      "time": "2024-11-15T09:00:00Z",
      "timeDisplay": "09:00 AM",
      "available": true
    },
    {
      "time": "2024-11-15T10:00:00Z",
      "timeDisplay": "10:00 AM",
      "available": false
    }
  ]
}
```

### Get All Appointments
```http
GET /api/calendar/appointments?startDate=2024-11-01&endDate=2024-11-30&status=CONFIRMED
Authorization: Bearer <token>
```

**Query Parameters:**
- `startDate` (optional) - ISO date string
- `endDate` (optional) - ISO date string
- `status` (optional) - PENDING | CONFIRMED | COMPLETED | CANCELLED | NO_SHOW

### Get Single Appointment
```http
GET /api/calendar/appointments/:id
Authorization: Bearer <token>
```

### Book Appointment
```http
POST /api/calendar/appointments
Authorization: Bearer <token>
Content-Type: application/json

{
  "customerName": "John Doe",
  "customerPhone": "+1234567890",
  "customerEmail": "john@example.com",
  "appointmentDate": "2024-11-15T10:00:00Z",
  "duration": 30,  // optional, uses business default if not provided
  "notes": "Initial consultation"
}
```

### Update Appointment
```http
PUT /api/calendar/appointments/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "COMPLETED",
  "notes": "Updated notes"
}
```

### Cancel Appointment
```http
DELETE /api/calendar/appointments/:id
Authorization: Bearer <token>
```

---

## 📦 Inventory & Products

### Get All Products
```http
GET /api/inventory/products?page=1&limit=50&category=Electronics
Authorization: Bearer <token>
```

**Query Parameters:**
- `page` (default: 1)
- `limit` (default: 50)
- `category` (optional)
- `lowStock` (optional) - true | false

### Get Low Stock Products
```http
GET /api/inventory/products/low-stock
Authorization: Bearer <token>
```

### Get Single Product
```http
GET /api/inventory/products/:id
Authorization: Bearer <token>
```

### Create Product
```http
POST /api/inventory/products
Authorization: Bearer <token>
Content-Type: application/json

{
  "sku": "PROD-001",
  "name": "Sample Product",
  "description": "Product description",
  "price": 29.99,
  "stockQuantity": 100,
  "lowStockThreshold": 10,
  "category": "Electronics",
  "imageUrl": "https://example.com/image.jpg"
}
```

### Update Product
```http
PUT /api/inventory/products/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Updated Product Name",
  "price": 34.99,
  "stockQuantity": 150
}
```

### Delete Product
```http
DELETE /api/inventory/products/:id
Authorization: Bearer <token>
```

### Import Products from CSV
```http
POST /api/inventory/products/import
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: <CSV file>
```

**CSV Format:**
```csv
sku,name,price,stockQuantity,lowStockThreshold,category,description
PROD-001,Product 1,29.99,100,10,Electronics,Description here
PROD-002,Product 2,19.99,50,5,Home,Another description
```

---

## 🚚 Shipping Management

### Get All Shipping Info
```http
GET /api/inventory/shipping?page=1&limit=50&status=IN_TRANSIT&carrier=UPS
Authorization: Bearer <token>
```

**Query Parameters:**
- `page` (default: 1)
- `limit` (default: 50)
- `status` (optional) - PENDING | SHIPPED | IN_TRANSIT | DELIVERED | RETURNED
- `carrier` (optional) - UPS | FEDEX | USPS | DHL | OTHER

### Track Package
```http
GET /api/inventory/shipping/track/:trackingNumber
Authorization: Bearer <token>
```

### Create Shipping Info
```http
POST /api/inventory/shipping
Authorization: Bearer <token>
Content-Type: application/json

{
  "orderId": "ORD-12345",
  "trackingNumber": "1Z999AA10123456784",
  "carrier": "UPS",
  "status": "PENDING",
  "estimatedDelivery": "2024-11-20T00:00:00Z",
  "customerPhone": "+1234567890",
  "customerEmail": "customer@example.com"
}
```

### Update Shipping Status
```http
PUT /api/inventory/shipping/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "DELIVERED",
  "actualDelivery": "2024-11-18T14:30:00Z"
}
```

---

## 📞 Call Logs

### Get Call Logs
```http
GET /api/call-logs?page=1&limit=50
Authorization: Bearer <token>
```

### Get Single Call Log
```http
GET /api/call-logs/:id
Authorization: Bearer <token>
```

---

## 💳 Subscription

### Get Subscription
```http
GET /api/subscription
Authorization: Bearer <token>
```

### Create/Update Subscription
```http
POST /api/subscription
Authorization: Bearer <token>
Content-Type: application/json

{
  "plan": "PRO",
  "stripeCustomerId": "cus_xxxxx"
}
```

---

## 📊 Response Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Missing or invalid token |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found |
| 500 | Internal Server Error |

---

## 🔒 Security Features

### Business Data Isolation
All endpoints automatically filter data by `businessId` from the authenticated user's JWT token. Users can only access their own business data.

### Role-Based Access Control
Some endpoints require specific roles:
- **OWNER** - Full access
- **ADMIN** - Management access
- **MEMBER** - Read-only access

Protected endpoints are marked with role requirements in the middleware.

---

## 🎯 Key Features

### ✅ Simplified Calendar
- **No Google OAuth** - Direct database appointments
- **No external setup** - Works out of the box
- **Easy to use** - Simple JSON configuration
- **Business hours** - Dedicated model per day
- **Smart availability** - Automatic slot generation with buffer times

### ✅ Complete Inventory
- Product management with SKU tracking
- CSV bulk import/export
- Low stock alerts
- Inventory change logs
- Multi-carrier shipping tracking

### ✅ AI Assistant
- Voice customization (gender, tone, speed, pitch)
- Custom greetings and instructions
- Call logging and transcripts
- VAPI integration ready

---

## 🧪 Testing Examples

### Test Backend Health
```bash
curl http://localhost:3001/health
```

### Test Login
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

### Test Authenticated Endpoint
```bash
curl -X GET http://localhost:3001/api/calendar/business-hours \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

## 📝 Notes

- All dates should be in ISO 8601 format
- All currency values are in USD (Float)
- Phone numbers should include country code (+1234567890)
- JWT tokens expire after 7 days (configurable)
- File uploads limited to 10MB

---

**For more information, check the main README.md file.**
