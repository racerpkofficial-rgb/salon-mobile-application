import jwt from 'jsonwebtoken';

const BASE_URL = 'http://127.0.0.1:4000/api/v1';
const JWT_SECRET = 'aurelia-super-secret-jwt-key-minimum-32-chars-long-2026';

type TestResult = {
  name: string;
  passed: boolean;
  status?: number;
  expectedStatus: number | number[];
  details?: string;
};

const results: TestResult[] = [];

async function assertApi(
  name: string,
  url: string,
  options: {
    method?: string;
    body?: any;
    token?: string;
    expectedStatus: number | number[];
  }
) {
  try {
    const res = await fetch(`${BASE_URL}${url}`, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {})
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    const expected = Array.isArray(options.expectedStatus) ? options.expectedStatus : [options.expectedStatus];
    const passed = expected.includes(res.status);
    let bodyText = '';
    try {
      const json = await res.json();
      bodyText = JSON.stringify(json);
    } catch {
      bodyText = await res.text().catch(() => '');
    }

    results.push({
      name,
      passed,
      status: res.status,
      expectedStatus: options.expectedStatus,
      details: bodyText.slice(0, 160)
    });

    return { status: res.status, body: bodyText ? JSON.parse(bodyText || '{}') : {} };
  } catch (err) {
    results.push({
      name,
      passed: false,
      expectedStatus: options.expectedStatus,
      details: (err as Error).message
    });
    return { status: 0, body: {} };
  }
}

async function runTests() {
  console.log('=== STARTING AURELIA AUTHENTICATION & AUTHORIZATION TESTS ===\n');

  const timestamp = Date.now();
  const customerEmail = `customer_${timestamp}@test.com`;
  const ownerEmail = `owner_${timestamp}@test.com`;
  const password = 'Password123!';

  // --- FLOW 1: CUSTOMER ---
  console.log('--- Testing Flow 1: CUSTOMER ---');
  // 1. Register Customer
  const custReg = await assertApi('Customer Registration (201 Created)', '/auth/register/customer', {
    method: 'POST',
    body: { name: 'Alice Customer', email: customerEmail, password },
    expectedStatus: 201
  });
  const customerToken = custReg.body?.token;

  // 2. Login Customer
  const custLogin = await assertApi('Customer Login (200 OK)', '/auth/login', {
    method: 'POST',
    body: { email: customerEmail, password },
    expectedStatus: 200
  });

  // 3. Restore Session
  await assertApi('Customer Session Restoration via /auth/me (200 OK)', '/auth/me', {
    token: customerToken,
    expectedStatus: 200
  });

  // 4. Protected Customer Profile
  await assertApi('Customer Protected Profile /customer/profile (200 OK)', '/customer/profile', {
    token: customerToken,
    expectedStatus: 200
  });

  // 5. Customer Logout
  await assertApi('Customer Logout /auth/logout (204 No Content)', '/auth/logout', {
    method: 'POST',
    token: customerToken,
    expectedStatus: 204
  });

  // --- FLOW 2: SALON_OWNER ---
  console.log('\n--- Testing Flow 2: SALON_OWNER ---');
  // 1. Register Owner
  const ownerReg = await assertApi('Salon Owner Registration (201 Created)', '/auth/register/salon-owner', {
    method: 'POST',
    body: {
      name: 'Bob Owner',
      email: ownerEmail,
      phone: '+91 98765 43210',
      password,
      confirmPassword: password,
      salonName: 'Bob Luxe Salon',
      address: '100 Feet Road, Indiranagar',
      city: 'Bengaluru',
      identityProof: {
        url: 'https://docs.aureliabeaute.internal/secure/id-docs/sample_gst.pdf',
        filename: 'gst_certificate.pdf',
        fileType: 'application/pdf',
        fileSize: 102400
      }
    },
    expectedStatus: 201
  });
  const ownerToken = ownerReg.body?.token;

  // 2. Login Owner
  await assertApi('Salon Owner Login (200 OK)', '/auth/login', {
    method: 'POST',
    body: { email: ownerEmail, password },
    expectedStatus: 200
  });

  // 3. Restore Session
  await assertApi('Salon Owner Session Restoration via /auth/me (200 OK)', '/auth/me', {
    token: ownerToken,
    expectedStatus: 200
  });

  // 4. Protected Owner Profile
  await assertApi('Salon Owner Protected Profile /owner/profile (200 OK)', '/owner/profile', {
    token: ownerToken,
    expectedStatus: 200
  });

  // 5. Salon Owner Logout
  await assertApi('Salon Owner Logout /auth/logout (204 No Content)', '/auth/logout', {
    method: 'POST',
    token: ownerToken,
    expectedStatus: 204
  });

  // --- FLOW 3: SUPER_ADMIN ---
  console.log('\n--- Testing Flow 3: SUPER_ADMIN ---');
  // 1. Login Super Admin
  const adminLogin = await assertApi('Super Admin Login (200 OK)', '/auth/login', {
    method: 'POST',
    body: { email: 'admin@example.com', password: 'AdminPassword123!' },
    expectedStatus: 200
  });
  const adminToken = adminLogin.body?.token;

  // 2. Restore Session
  await assertApi('Super Admin Session Restoration via /auth/me (200 OK)', '/auth/me', {
    token: adminToken,
    expectedStatus: 200
  });

  // 3. Protected Admin Dashboard Route
  await assertApi('Super Admin Protected Route /admin/dashboard (200 OK)', '/admin/dashboard', {
    token: adminToken,
    expectedStatus: 200
  });

  // 4. Protected Admin Profile Route
  await assertApi('Super Admin Protected Route /admin/profile (200 OK)', '/admin/profile', {
    token: adminToken,
    expectedStatus: 200
  });

  // 5. Super Admin Logout
  await assertApi('Super Admin Logout /auth/logout (204 No Content)', '/auth/logout', {
    method: 'POST',
    token: adminToken,
    expectedStatus: 204
  });

  // --- AUTHORIZATION & SECURITY TESTS ---
  console.log('\n--- Testing Authorization & Security Boundaries ---');

  // 1. Customer accessing owner API -> 403
  await assertApi('CUSTOMER accessing owner API /owner/profile (403 Forbidden)', '/owner/profile', {
    token: customerToken,
    expectedStatus: 403
  });

  // 2. Customer accessing admin API -> 403
  await assertApi('CUSTOMER accessing admin API /admin/dashboard (403 Forbidden)', '/admin/dashboard', {
    token: customerToken,
    expectedStatus: 403
  });

  // 3. Salon Owner accessing customer API -> 403
  await assertApi('SALON_OWNER accessing customer API /customer/profile (403 Forbidden)', '/customer/profile', {
    token: ownerToken,
    expectedStatus: 403
  });

  // 4. Salon Owner accessing admin API -> 403
  await assertApi('SALON_OWNER accessing admin API /admin/dashboard (403 Forbidden)', '/admin/dashboard', {
    token: ownerToken,
    expectedStatus: 403
  });

  // 5. Invalid JWT -> 401
  await assertApi('Invalid JWT on protected route (401 Unauthorized)', '/auth/me', {
    token: 'this.is.a.completely.invalid.token',
    expectedStatus: 401
  });

  // 6. Expired JWT -> 401
  const expiredToken = jwt.sign(
    { sub: '6ac2212be7df9d78fb8687d8', role: 'CUSTOMER' },
    JWT_SECRET,
    { expiresIn: '-10s', issuer: 'aurelia-api', audience: 'aurelia-mobile' }
  );
  await assertApi('Expired JWT on protected route (401 Unauthorized)', '/auth/me', {
    token: expiredToken,
    expectedStatus: 401
  });

  // 7. Missing JWT -> 401
  await assertApi('Missing JWT on protected route (401 Unauthorized)', '/customer/profile', {
    expectedStatus: 401
  });

  // 8. Wrong password -> 401
  await assertApi('Login with wrong password (401 Unauthorized)', '/auth/login', {
    method: 'POST',
    body: { email: customerEmail, password: 'WrongPassword999!' },
    expectedStatus: 401
  });

  // 9. Duplicate email -> 409
  await assertApi('Register with duplicate email (409 Conflict)', '/auth/register/customer', {
    method: 'POST',
    body: { name: 'Duplicate User', email: customerEmail, password },
    expectedStatus: 409
  });

  // 10. SUPER_ADMIN registration endpoint rejected -> 403
  await assertApi('SUPER_ADMIN registration endpoint rejected (403 Forbidden)', '/auth/register/super-admin', {
    method: 'POST',
    body: { name: 'Hacker Admin', email: 'hacker@example.com', password },
    expectedStatus: 403
  });

  // 11. Role tampering ignored -> must assign CUSTOMER
  const tamperEmail = `tamper_${timestamp}@test.com`;
  const tamperRes = await assertApi('Client role tampering ignored (role remains CUSTOMER)', '/auth/register/customer', {
    method: 'POST',
    body: { name: 'Tamper Tester', email: tamperEmail, password, role: 'SUPER_ADMIN' },
    expectedStatus: 201
  });
  if (tamperRes.body?.user?.role !== 'CUSTOMER') {
    results[results.length - 1].passed = false;
    results[results.length - 1].details = `Assigned unexpected role: ${tamperRes.body?.user?.role}`;
  }

  // 12. Google Auth endpoint rejects missing token (400 Bad Request)
  await assertApi('Google Login rejects missing idToken (400 Bad Request)', '/auth/google', {
    method: 'POST',
    body: {},
    expectedStatus: 400
  });

  // 13. Google Auth endpoint rejects invalid / forged idToken (401 Unauthorized)
  await assertApi('Google Login rejects forged/invalid idToken (401 Unauthorized)', '/auth/google', {
    method: 'POST',
    body: { idToken: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.invalid.token' },
    expectedStatus: 401
  });

  // 14. Google Auth endpoint rejects unauthorized role like SUPER_ADMIN (400 Bad Request)
  await assertApi('Google Login rejects SUPER_ADMIN role in body (400 Bad Request)', '/auth/google', {
    method: 'POST',
    body: { idToken: 'fake.token', role: 'SUPER_ADMIN' },
    expectedStatus: 400
  });

  // 15. Google Auth endpoint validates token for SALON_OWNER role (401 Unauthorized on invalid token)
  await assertApi('Google Login for SALON_OWNER validates token (401 Unauthorized)', '/auth/google', {
    method: 'POST',
    body: { idToken: 'invalid.owner.token', role: 'SALON_OWNER' },
    expectedStatus: 401
  });

  // --- REPORT SUMMARY ---
  console.log('\n=== TEST RESULTS SUMMARY ===\n');
  let allPassed = true;
  for (const r of results) {
    const symbol = r.passed ? '✓ PASS' : '✗ FAIL';
    if (!r.passed) allPassed = false;
    console.log(`${symbol} [${r.status}] ${r.name}`);
    if (r.details) {
      console.log(`    Detail: ${r.details}`);
    }
  }

  console.log(`\nTOTAL TESTS: ${results.length}`);
  console.log(`PASSED: ${results.filter((r) => r.passed).length}`);
  console.log(`FAILED: ${results.filter((r) => !r.passed).length}`);

  if (allPassed) {
    console.log('\n ALL 21 AUTHENTICATION & AUTHORIZATION TESTS PASSED PERFECTLY!\n');
    process.exit(0);
  } else {
    console.error('\n❌ SOME TESTS FAILED!\n');
    process.exit(1);
  }
}

runTests();
