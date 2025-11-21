import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

// ==================== BUSINESS HOURS ====================

// Get business hours
router.get('/business-hours', authenticateToken, async (req, res) => {
  try {
    let businessHours = await prisma.businessHours.findUnique({
      where: { businessId: req.businessId },
    });

    // If no business hours exist, create default ones
    if (!businessHours) {
      businessHours = await prisma.businessHours.create({
        data: {
          businessId: req.businessId,
        },
      });
    }

    res.json(businessHours);
  } catch (error) {
    console.error('Get business hours error:', error);
    res.status(500).json({ error: 'Failed to fetch business hours' });
  }
});

// Update business hours
router.put('/business-hours', authenticateToken, requireRole(['OWNER', 'ADMIN']), async (req, res) => {
  try {
    const { monday, tuesday, wednesday, thursday, friday, saturday, sunday } = req.body;

    const businessHours = await prisma.businessHours.upsert({
      where: { businessId: req.businessId },
      create: {
        businessId: req.businessId,
        monday,
        tuesday,
        wednesday,
        thursday,
        friday,
        saturday,
        sunday,
      },
      update: {
        ...(monday && { monday }),
        ...(tuesday && { tuesday }),
        ...(wednesday && { wednesday }),
        ...(thursday && { thursday }),
        ...(friday && { friday }),
        ...(saturday && { saturday }),
        ...(sunday && { sunday }),
      },
    });

    res.json({
      message: 'Business hours updated successfully',
      businessHours,
    });
  } catch (error) {
    console.error('Update business hours error:', error);
    res.status(500).json({ error: 'Failed to update business hours' });
  }
});

// Update booking settings (duration & buffer time)
router.put('/booking-settings', authenticateToken, requireRole(['OWNER', 'ADMIN']), async (req, res) => {
  try {
    const { bookingDuration, bufferTime } = req.body;

    if (bookingDuration && (bookingDuration < 15 || bookingDuration > 240)) {
      return res.status(400).json({ error: 'Booking duration must be between 15 and 240 minutes' });
    }

    if (bufferTime !== undefined && (bufferTime < 0 || bufferTime > 60)) {
      return res.status(400).json({ error: 'Buffer time must be between 0 and 60 minutes' });
    }

    const business = await prisma.business.update({
      where: { id: req.businessId },
      data: {
        ...(bookingDuration && { bookingDuration }),
        ...(bufferTime !== undefined && { bufferTime }),
      },
      select: {
        bookingDuration: true,
        bufferTime: true,
      },
    });

    res.json({
      message: 'Booking settings updated successfully',
      settings: business,
    });
  } catch (error) {
    console.error('Update booking settings error:', error);
    res.status(500).json({ error: 'Failed to update booking settings' });
  }
});

// ==================== APPOINTMENTS ====================

// Get all appointments
router.get('/appointments', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate, status } = req.query;

    const where = {
      businessId: req.businessId,
      ...(status && { status }),
      ...(startDate && endDate && {
        appointmentDate: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      }),
    };

    const appointments = await prisma.appointment.findMany({
      where,
      orderBy: { appointmentDate: 'asc' },
    });

    res.json(appointments);
  } catch (error) {
    console.error('Get appointments error:', error);
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

// Get single appointment
router.get('/appointments/:id', authenticateToken, async (req, res) => {
  try {
    const appointment = await prisma.appointment.findFirst({
      where: {
        id: parseInt(req.params.id),
        businessId: req.businessId,
      },
    });

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    res.json(appointment);
  } catch (error) {
    console.error('Get appointment error:', error);
    res.status(500).json({ error: 'Failed to fetch appointment' });
  }
});

// Check availability for a specific date
router.post('/availability', authenticateToken, async (req, res) => {
  try {
    const { date } = req.body;

    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }

    const requestDate = new Date(date);
    const dayName = requestDate.toLocaleDateString('en-US', { weekday: 'lowercase' });

    // Get business hours
    const businessHours = await prisma.businessHours.findUnique({
      where: { businessId: req.businessId },
    });

    if (!businessHours || !businessHours[dayName]) {
      return res.json({
        available: false,
        message: 'Business hours not configured',
        slots: [],
      });
    }

    const dayHours = businessHours[dayName];

    // Check if business is closed on this day
    if (dayHours.closed) {
      return res.json({
        available: false,
        message: 'Business is closed on this day',
        slots: [],
      });
    }

    // Get business settings
    const business = await prisma.business.findUnique({
      where: { id: req.businessId },
      select: {
        bookingDuration: true,
        bufferTime: true,
      },
    });

    const duration = business?.bookingDuration || 30;
    const buffer = business?.bufferTime || 15;

    // Get existing appointments for this day
    const startOfDay = new Date(requestDate);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(requestDate);
    endOfDay.setHours(23, 59, 59, 999);

    const existingAppointments = await prisma.appointment.findMany({
      where: {
        businessId: req.businessId,
        appointmentDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: { not: 'CANCELLED' },
      },
      select: {
        appointmentDate: true,
        duration: true,
      },
    });

    // Generate available time slots
    const slots = generateTimeSlots(
      dayHours.open,
      dayHours.close,
      duration,
      buffer,
      existingAppointments,
      requestDate
    );

    res.json({
      available: slots.length > 0,
      date: requestDate,
      businessHours: dayHours,
      slots,
    });
  } catch (error) {
    console.error('Check availability error:', error);
    res.status(500).json({ error: 'Failed to check availability' });
  }
});

// Book appointment (create new)
router.post('/appointments', authenticateToken, async (req, res) => {
  try {
    const { customerName, customerPhone, customerEmail, appointmentDate, duration, notes } = req.body;

    if (!customerName || !customerPhone || !appointmentDate) {
      return res.status(400).json({ error: 'Customer name, phone, and appointment date are required' });
    }

    // Get business settings for duration if not provided
    const business = await prisma.business.findUnique({
      where: { id: req.businessId },
      select: { bookingDuration: true },
    });

    const appointmentDuration = duration || business?.bookingDuration || 30;

    // Check if slot is available
    const appointmentDateTime = new Date(appointmentDate);
    const slotEndTime = new Date(appointmentDateTime.getTime() + appointmentDuration * 60000);

    // Check for conflicts
    const conflicts = await prisma.appointment.findMany({
      where: {
        businessId: req.businessId,
        status: { not: 'CANCELLED' },
        appointmentDate: {
          gte: new Date(appointmentDateTime.getTime() - 60 * 60000), // 1 hour before
          lte: slotEndTime,
        },
      },
    });

    if (conflicts.length > 0) {
      return res.status(400).json({ error: 'Time slot is not available' });
    }

    // Create appointment
    const appointment = await prisma.appointment.create({
      data: {
        businessId: req.businessId,
        customerName,
        customerPhone,
        customerEmail,
        appointmentDate: appointmentDateTime,
        duration: appointmentDuration,
        notes,
        status: 'CONFIRMED',
      },
    });

    res.status(201).json({
      message: 'Appointment booked successfully',
      appointment,
    });
  } catch (error) {
    console.error('Book appointment error:', error);
    res.status(500).json({ error: 'Failed to book appointment' });
  }
});

// Update appointment
router.put('/appointments/:id', authenticateToken, async (req, res) => {
  try {
    const { status, appointmentDate, duration, customerName, customerPhone, customerEmail, notes } = req.body;

    // Verify appointment belongs to user's business
    const existing = await prisma.appointment.findFirst({
      where: {
        id: parseInt(req.params.id),
        businessId: req.businessId,
      },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    const appointment = await prisma.appointment.update({
      where: { id: parseInt(req.params.id) },
      data: {
        ...(status && { status }),
        ...(appointmentDate && { appointmentDate: new Date(appointmentDate) }),
        ...(duration && { duration }),
        ...(customerName && { customerName }),
        ...(customerPhone && { customerPhone }),
        ...(customerEmail !== undefined && { customerEmail }),
        ...(notes !== undefined && { notes }),
      },
    });

    res.json({
      message: 'Appointment updated successfully',
      appointment,
    });
  } catch (error) {
    console.error('Update appointment error:', error);
    res.status(500).json({ error: 'Failed to update appointment' });
  }
});

// Cancel appointment
router.delete('/appointments/:id', authenticateToken, async (req, res) => {
  try {
    // Verify appointment belongs to user's business
    const existing = await prisma.appointment.findFirst({
      where: {
        id: parseInt(req.params.id),
        businessId: req.businessId,
      },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Update status to CANCELLED instead of deleting
    const appointment = await prisma.appointment.update({
      where: { id: parseInt(req.params.id) },
      data: { status: 'CANCELLED' },
    });

    res.json({
      message: 'Appointment cancelled successfully',
      appointment,
    });
  } catch (error) {
    console.error('Cancel appointment error:', error);
    res.status(500).json({ error: 'Failed to cancel appointment' });
  }
});

// ==================== HELPER FUNCTIONS ====================

function generateTimeSlots(openTime, closeTime, duration, buffer, existingAppointments, date) {
  const slots = [];
  
  // Parse open and close times
  const [openHour, openMinute] = openTime.split(':').map(Number);
  const [closeHour, closeMinute] = closeTime.split(':').map(Number);
  
  // Create date objects for start and end of business hours
  const startTime = new Date(date);
  startTime.setHours(openHour, openMinute, 0, 0);
  
  const endTime = new Date(date);
  endTime.setHours(closeHour, closeMinute, 0, 0);
  
  // Current slot time
  let currentTime = new Date(startTime);
  
  while (currentTime < endTime) {
    const slotEndTime = new Date(currentTime.getTime() + duration * 60000);
    
    // Check if slot end time exceeds business hours
    if (slotEndTime > endTime) {
      break;
    }
    
    // Check if this slot conflicts with existing appointments
    const hasConflict = existingAppointments.some(apt => {
      const aptStart = new Date(apt.appointmentDate);
      const aptEnd = new Date(aptStart.getTime() + apt.duration * 60000 + buffer * 60000);
      
      return (currentTime >= aptStart && currentTime < aptEnd) ||
             (slotEndTime > aptStart && slotEndTime <= aptEnd) ||
             (currentTime <= aptStart && slotEndTime >= aptEnd);
    });
    
    // Check if slot is in the past
    const now = new Date();
    const isPast = currentTime < now;
    
    slots.push({
      time: currentTime.toISOString(),
      timeDisplay: currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      available: !hasConflict && !isPast,
    });
    
    // Move to next slot (duration + buffer)
    currentTime = new Date(currentTime.getTime() + (duration + buffer) * 60000);
  }
  
  return slots;
}

export default router;