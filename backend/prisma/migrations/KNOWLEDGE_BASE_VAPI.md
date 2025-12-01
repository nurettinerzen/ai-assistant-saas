# Prisma Migration - Knowledge Base VAPI Integration

## Required Schema Changes

Add `vapiKnowledgeId` field to KnowledgeBase model for VAPI integration.

### Current Schema (Line ~467):
```prisma
model KnowledgeBase {
  id          String   @id @default(cuid())
  businessId  Int
  business    Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  
  type        KnowledgeType     // DOCUMENT, FAQ, URL
  title       String
  content     String?  @db.Text
  
  // For documents
  fileName    String?
  fileSize    Int?
  mimeType    String?
  filePath    String?
  
  // For URLs
  url         String?
  crawlDepth  Int?
  pageCount   Int?
  lastCrawled DateTime?
  
  // For FAQs
  question    String?  @db.Text
  answer      String?  @db.Text
  category    String?
  
  status      KnowledgeStatus @default(PROCESSING)
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([businessId])
  @@index([type])
  @@index([status])
}
```

### Updated Schema (ADD THIS FIELD):
```prisma
model KnowledgeBase {
  id          String   @id @default(cuid())
  businessId  Int
  business    Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  
  type        KnowledgeType
  title       String
  content     String?  @db.Text
  
  // For documents
  fileName    String?
  fileSize    Int?
  mimeType    String?
  filePath    String?
  
  // For URLs
  url         String?
  crawlDepth  Int?
  pageCount   Int?
  lastCrawled DateTime?
  
  // For FAQs
  question    String?  @db.Text
  answer      String?  @db.Text
  category    String?
  
  // ⭐ NEW: VAPI Knowledge Base Integration
  vapiKnowledgeId String?  @unique  // VAPI knowledge item ID
  
  status      KnowledgeStatus @default(PROCESSING)
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([businessId])
  @@index([type])
  @@index([status])
  @@index([vapiKnowledgeId])  // NEW INDEX
}
```

### Migration Commands:
```bash
# Navigate to backend directory
cd /app/backend

# Create migration
npx prisma migrate dev --name add_vapi_knowledge_id

# Or if already in production
npx prisma migrate deploy
```

### What this enables:
- ✅ Sync knowledge base items with VAPI AI assistant
- ✅ Track VAPI knowledge item IDs for updates/deletes
- ✅ Automatic AI training when documents/FAQs/URLs are added
- ✅ Bidirectional sync between database and VAPI

### Backend Implementation:
- `/backend/src/services/vapiKnowledge.js` - VAPI API client
- `/backend/src/routes/knowledge.js` - Updated to sync with VAPI
- Automatic upload on create
- Automatic delete on remove
