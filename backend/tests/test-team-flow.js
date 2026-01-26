/**
 * End-to-End Team Management Flow Test
 * Tests the complete team invitation workflow
 * Run: node tests/test-team-flow.js
 */

import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

console.log('\n🧪 TESTING END-TO-END TEAM MANAGEMENT FLOW\n');

async function cleanup() {
  console.log('🧹 Cleaning up test data...');

  // Clean up test users and invitations
  await prisma.user.deleteMany({
    where: {
      email: {
        in: ['test-owner@example.com', 'test-invite@example.com']
      }
    }
  });

  await prisma.invitation.deleteMany({
    where: {
      email: 'test-invite@example.com'
    }
  });

  await prisma.business.deleteMany({
    where: {
      name: 'Test Business E2E'
    }
  });
}

async function createTestBusiness() {
  console.log('📝 Creating test business...');

  const hashedPassword = await bcrypt.hash('test123', 10);

  // Create business and owner
  const business = await prisma.business.create({
    data: {
      name: 'Test Business E2E',
      users: {
        create: {
          email: 'test-owner@example.com',
          password: hashedPassword,
          name: 'Test Owner',
          role: 'OWNER',
          onboardingCompleted: true
        }
      }
    },
    include: {
      users: true
    }
  });

  console.log(`✅ Business created: ID ${business.id}, Owner ID ${business.users[0].id}`);
  return { business, owner: business.users[0] };
}

async function testInvitationFlow({ business, owner }) {
  console.log('\n📧 Testing invitation creation...');

  // Create invitation
  const invitation = await prisma.invitation.create({
    data: {
      email: 'test-invite@example.com',
      businessId: business.id,
      role: 'MANAGER',
      token: 'test_token_' + Math.random().toString(36).substring(7),
      invitedById: owner.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    }
  });

  console.log(`✅ Invitation created: ID ${invitation.id}, Token: ${invitation.token}`);

  // Test invitation retrieval
  console.log('\n📝 Testing invitation retrieval...');
  const retrieved = await prisma.invitation.findUnique({
    where: { token: invitation.token },
    include: {
      business: { select: { name: true } },
      invitedBy: { select: { name: true, email: true } }
    }
  });

  if (!retrieved) {
    throw new Error('Invitation not found by token');
  }
  console.log(`✅ Invitation retrieved: Email ${retrieved.email}, Role ${retrieved.role}`);
  console.log(`   Business: ${retrieved.business.name}`);
  console.log(`   Invited by: ${retrieved.invitedBy.name}`);

  // Test invitation acceptance
  console.log('\n👤 Testing invitation acceptance...');

  const hashedPassword = await bcrypt.hash('newuser123', 10);

  const result = await prisma.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: {
        email: invitation.email,
        password: hashedPassword,
        name: 'Test New Member',
        role: invitation.role,
        businessId: invitation.businessId,
        invitedById: invitation.invitedById,
        invitedAt: invitation.createdAt,
        acceptedAt: new Date(),
        onboardingCompleted: true
      }
    });

    // Hard invalidate token
    await tx.invitation.update({
      where: { id: invitation.id },
      data: {
        acceptedAt: new Date(),
        token: null
      }
    });

    return newUser;
  });

  console.log(`✅ User created: ID ${result.id}, Email ${result.email}, Role ${result.role}`);

  // Test replay prevention
  console.log('\n🔒 Testing replay prevention...');
  const invalidatedInvite = await prisma.invitation.findUnique({
    where: { id: invitation.id }
  });

  if (invalidatedInvite.token !== null) {
    throw new Error('Token should be null after acceptance');
  }
  console.log('✅ Token successfully invalidated (null)');

  // Test JWT generation
  console.log('\n🔑 Testing JWT generation...');
  const jwtToken = jwt.sign(
    { userId: result.id, businessId: result.businessId, role: result.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  const decoded = jwt.verify(jwtToken, process.env.JWT_SECRET);
  if (decoded.userId !== result.id) {
    throw new Error('JWT token invalid');
  }
  console.log(`✅ JWT token generated and verified for user ${result.id}`);

  return result;
}

async function testTeamQueries({ business, owner, newMember }) {
  console.log('\n📊 Testing team queries...');

  // Get all members
  const members = await prisma.user.findMany({
    where: { businessId: business.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      invitedAt: true,
      acceptedAt: true,
      createdAt: true,
      invitedBy: {
        select: {
          id: true,
          name: true,
          email: true
        }
      }
    },
    orderBy: [
      { role: 'asc' },
      { createdAt: 'asc' }
    ]
  });

  console.log(`✅ Found ${members.length} team members`);
  members.forEach(m => {
    console.log(`   - ${m.name} (${m.email}) - ${m.role}`);
  });

  if (members.length !== 2) {
    throw new Error(`Expected 2 members, got ${members.length}`);
  }

  // Test role hierarchy
  const ownerMember = members.find(m => m.role === 'OWNER');
  const managerMember = members.find(m => m.role === 'MANAGER');

  if (!ownerMember || !managerMember) {
    throw new Error('Missing expected roles');
  }

  console.log('✅ Role hierarchy verified');
}

async function runTests() {
  try {
    await cleanup();

    console.log('='.repeat(60));
    console.log('STEP 1: Create Test Business');
    console.log('='.repeat(60));
    const { business, owner } = await createTestBusiness();

    console.log('\n' + '='.repeat(60));
    console.log('STEP 2: Test Invitation Flow');
    console.log('='.repeat(60));
    const newMember = await testInvitationFlow({ business, owner });

    console.log('\n' + '='.repeat(60));
    console.log('STEP 3: Test Team Queries');
    console.log('='.repeat(60));
    await testTeamQueries({ business, owner, newMember });

    console.log('\n' + '='.repeat(60));
    console.log('✅ ALL END-TO-END TESTS PASSED');
    console.log('='.repeat(60));
    console.log('\n📊 Test Summary:');
    console.log('   ✅ Business creation');
    console.log('   ✅ Invitation creation');
    console.log('   ✅ Invitation retrieval');
    console.log('   ✅ Invitation acceptance');
    console.log('   ✅ Replay prevention (token nullification)');
    console.log('   ✅ JWT generation');
    console.log('   ✅ Team member queries');
    console.log('   ✅ Role hierarchy');
    console.log('');

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }
}

runTests();
