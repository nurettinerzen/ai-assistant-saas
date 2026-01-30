#!/bin/bash

# Production Migration Deployment Script
# Deploys all pending Prisma migrations to production database

set -e  # Exit on error

echo "🚀 Deploying Production Migrations"
echo "=================================="
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR: DATABASE_URL environment variable not set"
  echo "   Set your production database URL:"
  echo "   export DATABASE_URL='postgresql://user:pass@host:port/db'"
  exit 1
fi

echo "📊 Current migration status:"
npx prisma migrate status
echo ""

echo "⚠️  WARNING: This will apply migrations to production database!"
echo "   Database: $(echo $DATABASE_URL | sed 's/:[^:]*@/@/g')"
echo ""
read -p "Continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
  echo "❌ Aborted"
  exit 0
fi

echo ""
echo "📦 Deploying migrations..."
npx prisma migrate deploy

echo ""
echo "✅ Migrations deployed successfully!"
echo ""

echo "📊 Final migration status:"
npx prisma migrate status

echo ""
echo "🎉 Done!"
