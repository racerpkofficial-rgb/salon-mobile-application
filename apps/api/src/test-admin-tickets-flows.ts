import mongoose from 'mongoose';
import { app } from './application.js';
import { User } from './models/User.js';
import { SupportTicket } from './models/SupportTicket.js';
import bcrypt from 'bcryptjs';
import { issueToken } from './services/token.service.js';
import { env } from './config/env.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: any) {
  if (condition) {
    passed++;
    console.log(`✓ PASS ${testName}`);
  } else {
    failed++;
    console.error(`✗ FAIL ${testName}`, detail ? `\n    Detail: ${JSON.stringify(detail)}` : '');
  }
}

async function runAdminTicketsTestSuite() {
  console.log('=== STARTING BOOK MY SALON ADMIN SUPPORT TICKETS TEST SUITE ===\n');

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(env.MONGODB_URI);
  }

  const server = app.listen(0);
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 4000;
  const baseUrl = `http://127.0.0.1:${port}/api/v1`;

  const ts = Date.now();
  const passwordHash = await bcrypt.hash('Secret123!', 10);

  // 1. Setup users
  const customerUser = await User.create({
    name: 'Ticket Tester Customer',
    email: `cust_ticket_${ts}@test.com`,
    passwordHash,
    role: 'CUSTOMER',
    isActive: true
  });

  const ownerUser = await User.create({
    name: 'Ticket Tester Owner',
    email: `owner_ticket_${ts}@test.com`,
    passwordHash,
    role: 'SALON_OWNER',
    isActive: true
  });

  const adminUser = await User.create({
    name: 'Support Operations Admin',
    email: `admin_ticket_${ts}@test.com`,
    passwordHash,
    role: 'SUPER_ADMIN',
    isActive: true
  });

  const customerToken = issueToken({
    sub: customerUser._id.toString(),
    role: 'CUSTOMER'
  });

  const ownerToken = issueToken({
    sub: ownerUser._id.toString(),
    role: 'SALON_OWNER'
  });

  const adminToken = issueToken({
    sub: adminUser._id.toString(),
    role: 'SUPER_ADMIN'
  });

  let createdCustomerTicketId = '';
  let createdOwnerTicketId = '';

  // Test 1: Customer submits problem report
  {
    const res = await fetch(`${baseUrl}/profile/report-problem`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`
      },
      body: JSON.stringify({
        category: 'Booking or Appointment Issue',
        subject: 'Cannot confirm appointment for Saturday',
        description: 'Encountered payment checkout error during salon booking confirmation.',
        contactEmail: 'custom_contact@test.com'
      })
    });
    const body = await res.json();
    createdCustomerTicketId = body.ticketId;

    const ticketInDb = await SupportTicket.findOne({ ticketId: createdCustomerTicketId });

    assert(
      res.status === 201 &&
        typeof body.ticketId === 'string' &&
        body.ticketId.startsWith('BMS-') &&
        ticketInDb !== null &&
        ticketInDb.status === 'OPEN' &&
        ticketInDb.subject === 'Cannot confirm appointment for Saturday' &&
        ticketInDb.contactEmail === 'custom_contact@test.com' &&
        ticketInDb.userName === customerUser.name,
      'Customer report-problem persists SupportTicket in MongoDB',
      { status: res.status, body, dbStatus: ticketInDb?.status }
    );
  }

  // Test 2: Salon owner submits problem report
  {
    const res = await fetch(`${baseUrl}/profile/report-problem`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`
      },
      body: JSON.stringify({
        category: 'Payment / Subscription',
        subject: 'Subscription renewal invoice question',
        description: 'Need copy of official GST tax invoice for annual salon subscription.'
      })
    });
    const body = await res.json();
    createdOwnerTicketId = body.ticketId;

    const ticketInDb = await SupportTicket.findOne({ ticketId: createdOwnerTicketId });

    assert(
      res.status === 201 &&
        ticketInDb !== null &&
        ticketInDb.userRole === 'SALON_OWNER' &&
        ticketInDb.status === 'OPEN',
      'Salon owner report-problem persists SupportTicket in MongoDB',
      { status: res.status, body, role: ticketInDb?.userRole }
    );
  }

  // Test 3: Unauthenticated user rejected on admin tickets endpoint (401)
  {
    const res = await fetch(`${baseUrl}/admin/tickets`);
    const body = await res.json();
    assert(
      res.status === 401 && body.message === 'Authentication required',
      'Unauthenticated request to GET /admin/tickets returns 401',
      body
    );
  }

  // Test 4: Customer forbidden from admin tickets endpoint (403)
  {
    const res = await fetch(`${baseUrl}/admin/tickets`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    const body = await res.json();
    assert(
      res.status === 403 && body.message === 'Insufficient permissions',
      'CUSTOMER forbidden from GET /admin/tickets (403)',
      body
    );
  }

  // Test 5: Salon Owner forbidden from admin tickets endpoint (403)
  {
    const res = await fetch(`${baseUrl}/admin/tickets`, {
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    const body = await res.json();
    assert(
      res.status === 403 && body.message === 'Insufficient permissions',
      'SALON_OWNER forbidden from GET /admin/tickets (403)',
      body
    );
  }

  // Test 6: SUPER_ADMIN successfully lists tickets with pagination & stats
  {
    const res = await fetch(`${baseUrl}/admin/tickets?page=1&limit=10`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const body = await res.json();

    assert(
      res.status === 200 &&
        Array.isArray(body.tickets) &&
        body.total >= 2 &&
        body.page === 1 &&
        typeof body.stats?.open === 'number' &&
        body.stats.open >= 2,
      'SUPER_ADMIN successfully lists tickets with pagination and status counts',
      { status: res.status, total: body.total, stats: body.stats }
    );
  }

  // Test 7: Filter tickets by status
  {
    const res = await fetch(`${baseUrl}/admin/tickets?status=OPEN`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const body = await res.json();

    const allOpen = body.tickets.every((t: any) => t.status === 'OPEN');
    assert(
      res.status === 200 && body.tickets.length >= 2 && allOpen,
      'Filtering tickets by status=OPEN returns only OPEN tickets',
      { count: body.tickets.length, allOpen }
    );
  }

  // Test 8: Search tickets by keyword
  {
    const res = await fetch(`${baseUrl}/admin/tickets?search=Saturday`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const body = await res.json();

    const found = body.tickets.some((t: any) => t.ticketId === createdCustomerTicketId);
    assert(
      res.status === 200 && found,
      'Searching tickets by keyword returns matching ticket',
      { count: body.tickets.length, found }
    );
  }

  // Test 9: Get ticket details by ticketId or _id
  {
    const res = await fetch(`${baseUrl}/admin/tickets/${createdCustomerTicketId}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const body = await res.json();

    assert(
      res.status === 200 &&
        body.ticket?.ticketId === createdCustomerTicketId &&
        body.ticket?.subject === 'Cannot confirm appointment for Saturday' &&
        body.ticket?.category === 'Booking or Appointment Issue',
      'SUPER_ADMIN retrieves full ticket details',
      body
    );
  }

  // Test 10: Non-admin forbidden from updating ticket status (403)
  {
    const res = await fetch(`${baseUrl}/admin/tickets/${createdCustomerTicketId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`
      },
      body: JSON.stringify({ status: 'IN_PROGRESS' })
    });
    const body = await res.json();

    assert(
      res.status === 403,
      'Non-admin forbidden from PATCH /admin/tickets/:id/status (403)',
      body
    );
  }

  // Test 11: Invalid status value rejected (400)
  {
    const res = await fetch(`${baseUrl}/admin/tickets/${createdCustomerTicketId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ status: 'INVALID_STATUS' })
    });
    const body = await res.json();

    assert(
      res.status === 400,
      'Invalid ticket status update rejected with 400 Bad Request',
      body
    );
  }

  // Test 12: SUPER_ADMIN updates status to IN_PROGRESS with admin notes
  {
    const res = await fetch(`${baseUrl}/admin/tickets/${createdCustomerTicketId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        status: 'IN_PROGRESS',
        adminNotes: 'Assigned to billing tech team to investigate transaction gateway callback.'
      })
    });
    const body = await res.json();

    assert(
      res.status === 200 &&
        body.ticket?.status === 'IN_PROGRESS' &&
        body.ticket?.adminNotes?.includes('Assigned to billing tech team'),
      'SUPER_ADMIN updates status to IN_PROGRESS with notes',
      body
    );
  }

  // Test 13: SUPER_ADMIN updates status to RESOLVED (records resolvedAt & resolvedBy)
  {
    const res = await fetch(`${baseUrl}/admin/tickets/${createdCustomerTicketId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        status: 'RESOLVED',
        adminNotes: 'Resolved issue. Provided customer with direct booking link.'
      })
    });
    const body = await res.json();

    const dbTicket = await SupportTicket.findOne({ ticketId: createdCustomerTicketId });

    assert(
      res.status === 200 &&
        body.ticket?.status === 'RESOLVED' &&
        dbTicket?.status === 'RESOLVED' &&
        dbTicket?.resolvedAt !== undefined &&
        dbTicket?.resolvedBy?.toString() === adminUser._id.toString(),
      'SUPER_ADMIN updates status to RESOLVED with resolvedAt and resolvedBy metadata',
      { status: res.status, dbStatus: dbTicket?.status, resolvedAt: dbTicket?.resolvedAt }
    );
  }

  // Test 14: Updated status reflected in stats
  {
    const res = await fetch(`${baseUrl}/admin/tickets`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const body = await res.json();

    assert(
      res.status === 200 && body.stats?.resolved >= 1 && body.stats?.open >= 1,
      'Ticket stats accurately reflect resolved count and remaining open count',
      body.stats
    );
  }

  server.close();

  console.log('\n=== ADMIN SUPPORT TICKETS TEST SUITE SUMMARY ===');
  console.log(`TOTAL TESTS: ${passed + failed}`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);

  if (failed === 0) {
    console.log('\n🎉 ALL ADMIN SUPPORT TICKET FEATURES PASSED WITH 100% SUCCESS!');
    process.exit(0);
  } else {
    console.error('\n❌ SOME ADMIN SUPPORT TICKET TESTS FAILED.');
    process.exit(1);
  }
}

void runAdminTicketsTestSuite();
