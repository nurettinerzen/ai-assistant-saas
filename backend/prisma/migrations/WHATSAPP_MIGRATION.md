# Prisma Migration - WhatsApp Multi-Tenant Support

## Changes Required

The schema has been updated to support multi-tenant WhatsApp Business API integration.

### Schema Changes:

#### 1. Business Model - New Fields
```prisma
whatsappPhoneNumberId   String?
whatsappAccessToken     String?
whatsappVerifyToken     String?
whatsappWebhookUrl      String?
```

#### 2. IntegrationType Enum - New Value
```prisma
enum IntegrationType {
  ...existing values...
  WHATSAPP
  CUSTOM
}
```

### Migration SQL:
When Prisma is available, run:
```bash
npx prisma migrate dev --name add_whatsapp_fields
```

Or apply manually:
```sql
-- Add WhatsApp fields to Business table
ALTER TABLE "Business" ADD COLUMN "whatsappPhoneNumberId" TEXT;
ALTER TABLE "Business" ADD COLUMN "whatsappAccessToken" TEXT;
ALTER TABLE "Business" ADD COLUMN "whatsappVerifyToken" TEXT;
ALTER TABLE "Business" ADD COLUMN "whatsappWebhookUrl" TEXT;

-- Add WHATSAPP to IntegrationType enum
ALTER TYPE "IntegrationType" ADD VALUE 'WHATSAPP';
```

### Notes:
- All new fields are optional (nullable)
- `whatsappAccessToken` will be encrypted before storage using AES-256-GCM
- Each business can connect their own WhatsApp Business API credentials
- The webhook URL is auto-generated per business

### Security:
- Access tokens are encrypted at rest
- Verify tokens are used for webhook validation
- Rate limiting applied to webhook endpoints
