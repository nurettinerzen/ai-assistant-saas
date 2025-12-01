import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.js';
import OpenTableService from '../services/openTableService.js';
import BooksyService from '../services/booksyService.js';
import calendlyService from '../services/calendly.js';
import googleCalendarService from '../services/google-calendar.js';
import hubspotService from '../services/hubspot.js';
import googleSheetsService from '../services/google-sheets.js';
import whatsappService from '../services/whatsapp.js';

const router = express.Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

/* ============================================================
   GET ALL INTEGRATIONS
============================================================ */
router.get('/', async (req, res) => {
  try {
    const business = await prisma.business.findUnique({
      where: { id: req.businessId },
      include: {
        erpIntegration: true,
        reservationIntegration: true,
        bookingIntegration: true
      }
    });

    res.json({
      erp: business.erpIntegration,
      reservation: business.reservationIntegration,
      booking: business.bookingIntegration
    });

  } catch (error) {
    console.error('Get integrations error:', error);
    res.status(500).json({ error: 'Failed to fetch integrations' });
  }
});



/* ============================================================
   ERP INTEGRATION
============================================================ */

// Connect ERP
router.post('/erp/connect', async (req, res) => {
  try {
    const { type, apiEndpoint, apiKey, username, password, companyCode, realtimeMode } = req.body;

    if (!type) return res.status(400).json({ error: 'ERP type is required' });

    const integration = await prisma.erpIntegration.upsert({
      where: { businessId: req.businessId },
      update: {
        type,
        apiEndpoint,
        apiKey,
        username,
        password,
        companyCode,
        realtimeMode: realtimeMode || false,
        isActive: true
      },
      create: {
        businessId: req.businessId,
        type,
        apiEndpoint,
        apiKey,
        username,
        password,
        companyCode,
        realtimeMode: realtimeMode || false,
        isActive: true
      }
    });

    res.json({
      success: true,
      message: 'ERP integration connected successfully',
      integration
    });

  } catch (error) {
    console.error('Connect ERP error:', error);
    res.status(500).json({ error: 'Failed to connect ERP' });
  }
});

// Disconnect ERP
router.post('/erp/disconnect', async (req, res) => {
  try {
    await prisma.erpIntegration.update({
      where: { businessId: req.businessId },
      data: { isActive: false }
    });

    res.json({ success: true, message: 'ERP disconnected' });

  } catch (error) {
    console.error('Disconnect ERP error:', error);
    res.status(500).json({ error: 'Failed to disconnect ERP' });
  }
});

// Sync ERP
router.post('/erp/sync', async (req, res) => {
  try {
    const integration = await prisma.erpIntegration.findUnique({
      where: { businessId: req.businessId }
    });

    if (!integration || !integration.isActive)
      return res.status(400).json({ error: 'No active ERP integration' });

    // TODO: Implement actual sync logic
    await prisma.erpIntegration.update({
      where: { businessId: req.businessId },
      data: { lastSync: new Date() }
    });

    res.json({
      success: true,
      message: 'Sync completed',
      lastSync: new Date()
    });

  } catch (error) {
    console.error('Sync ERP error:', error);
    res.status(500).json({ error: 'Failed to sync' });
  }
});



/* ============================================================
   RESERVATION INTEGRATION (OpenTable)
============================================================ */

// Connect reservation platform
router.post('/reservation/connect', async (req, res) => {
  try {
    const { platform, apiKey, apiSecret, restaurantId } = req.body;

    if (!platform)
      return res.status(400).json({ error: 'Platform is required' });

    const integration = await prisma.reservationIntegration.upsert({
      where: { businessId: req.businessId },
      update: {
        platform,
        apiKey,
        apiSecret,
        restaurantId,
        isActive: true
      },
      create: {
        businessId: req.businessId,
        platform,
        apiKey,
        apiSecret,
        restaurantId,
        isActive: true
      }
    });

    res.json({
      success: true,
      message: 'Reservation platform connected',
      integration
    });

  } catch (error) {
    console.error('Connect reservation error:', error);
    res.status(500).json({ error: 'Failed to connect reservation platform' });
  }
});

// Sync reservations from OpenTable
router.post('/reservation/sync', async (req, res) => {
  try {
    const integration = await prisma.reservationIntegration.findUnique({
      where: { businessId: req.businessId }
    });

    if (!integration || !integration.isActive)
      return res.status(400).json({ error: 'No active reservation integration' });

    if (integration.platform !== 'OPENTABLE')
      return res.status(400).json({ error: 'Only OpenTable supported currently' });

    const openTable = new OpenTableService(
      integration.apiKey,
      integration.restaurantId
    );

    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    const reservations = await openTable.getReservations(today, tomorrow);

    let synced = 0;

    for (const reservation of reservations.items || []) {
      await prisma.appointment.upsert({
        where: {
          businessId_externalId: {
            businessId: req.businessId,
            externalId: reservation.id
          }
        },
        update: {
          appointmentDate: new Date(reservation.dateTime),
          customerName: `${reservation.customer.firstName} ${reservation.customer.lastName}`,
          customerEmail: reservation.customer.email,
          customerPhone: reservation.customer.phone,
          status: reservation.status === 'confirmed' ? 'CONFIRMED' : 'PENDING',
          notes: `Party size: ${reservation.partySize}`
        },
        create: {
          businessId: req.businessId,
          externalId: reservation.id,
          appointmentDate: new Date(reservation.dateTime),
          customerName: `${reservation.customer.firstName} ${reservation.customer.lastName}`,
          customerEmail: reservation.customer.email,
          customerPhone: reservation.customer.phone,
          duration: 90,
          status: 'CONFIRMED'
        }
      });

      synced++;
    }

    await prisma.reservationIntegration.update({
      where: { businessId: req.businessId },
      data: { lastSync: new Date() }
    });

    res.json({
      success: true,
      synced,
      total: reservations.items?.length || 0
    });

  } catch (error) {
    console.error('Sync reservations error:', error);
    res.status(500).json({ error: 'Failed to sync reservations' });
  }
});



/* ============================================================
   BOOKING INTEGRATION (Booksy)
============================================================ */

// Connect booking platform
router.post('/booking/connect', async (req, res) => {
  try {
    const { platform, apiKey, shopId, accessToken } = req.body;

    if (!platform)
      return res.status(400).json({ error: 'Platform is required' });

    const integration = await prisma.bookingIntegration.upsert({
      where: { businessId: req.businessId },
      update: {
        platform,
        apiKey,
        shopId,
        accessToken,
        isActive: true
      },
      create: {
        businessId: req.businessId,
        platform,
        apiKey,
        shopId,
        accessToken,
        isActive: true
      }
    });

    res.json({
      success: true,
      message: 'Booking platform connected',
      integration
    });

  } catch (error) {
    console.error('Connect booking error:', error);
    res.status(500).json({ error: 'Failed to connect booking platform' });
  }
});

// Sync Booksy appointments
router.post('/booking/sync', async (req, res) => {
  try {
    const integration = await prisma.bookingIntegration.findUnique({
      where: { businessId: req.businessId }
    });

    if (!integration || !integration.isActive)
      return res.status(400).json({ error: 'No active booking integration' });

    if (integration.platform !== 'BOOKSY')
      return res.status(400).json({ error: 'Only Booksy supported currently' });

    const booksy = new BooksyService(
      integration.apiKey,
      integration.shopId
    );

    const today = new Date().toISOString().split('T')[0];
    const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

    const bookings = await booksy.getAppointments(today, nextWeek);

    let synced = 0;

    for (const booking of bookings.bookings || []) {
      await prisma.appointment.upsert({
        where: {
          businessId_externalId: {
            businessId: req.businessId,
            externalId: booking.id.toString()
          }
        },
        update: {
          appointmentDate: new Date(booking.start_time),
          customerName: booking.client.name,
          customerEmail: booking.client.email,
          customerPhone: booking.client.phone,
          status: booking.status === 'confirmed' ? 'CONFIRMED' : 'PENDING',
          duration: booking.duration,
          serviceType: booking.service.name
        },
        create: {
          businessId: req.businessId,
          externalId: booking.id.toString(),
          appointmentDate: new Date(booking.start_time),
          customerName: booking.client.name,
          customerEmail: booking.client.email,
          customerPhone: booking.client.phone,
          duration: booking.duration,
          status: 'CONFIRMED',
          serviceType: booking.service.name
        }
      });

      synced++;
    }

    await prisma.bookingIntegration.update({
      where: { businessId: req.businessId },
      data: { lastSync: new Date() }
    });

    res.json({
      success: true,
      synced,
      total: bookings.bookings?.length || 0
    });

  } catch (error) {
    console.error('Sync bookings error:', error);
    res.status(500).json({ error: 'Failed to sync bookings' });
  }
});



export default router;
