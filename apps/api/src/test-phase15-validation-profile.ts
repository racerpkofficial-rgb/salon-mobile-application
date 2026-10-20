import { MongoClient } from 'mongodb';

const BASE_URL = 'http://127.0.0.1:4000/api/v1';

async function request(path: string, options: { method?: string; body?: any; token?: string } = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

async function run() {
  console.log('========================================================================');
  console.log('   PHASE 15: REGISTRATION VALIDATION, SALON ID PROOF & PROFILE AUDIT    ');
  console.log('========================================================================\n');

  const ts = Date.now();
  const strongPassword = 'AureliaPassword2026!';
  const weakPassword = 'weak';

  // -------------------------------------------------------------------------
  // Scenario 1: Customer registration with valid matching passwords
  // -------------------------------------------------------------------------
  console.log('Scenario 1: Customer registration with valid matching passwords...');
  const custEmail1 = `valid_cust_${ts}@test.com`;
  const custRes1 = await request('/auth/register/customer', {
    method: 'POST',
    body: {
      name: 'Sophia Laurent',
      email: custEmail1,
      password: strongPassword,
      confirmPassword: strongPassword,
      phone: '+91 98450 11223'
    }
  });

  if (custRes1.status !== 201) {
    throw new Error(`Scenario 1 Failed: Expected 201, got ${custRes1.status} (${JSON.stringify(custRes1.data)})`);
  }
  if (!custRes1.data.token || !custRes1.data.user) {
    throw new Error('Scenario 1 Failed: Missing token or user object');
  }
  if (custRes1.data.user.password || custRes1.data.user.passwordHash) {
    throw new Error('Scenario 1 Failed: Password or passwordHash exposed in response');
  }
  const custToken1 = custRes1.data.token;
  console.log('   ✓ Customer registered successfully with matching strong passwords.\n');

  // -------------------------------------------------------------------------
  // Scenario 2: Customer registration with mismatched passwords
  // -------------------------------------------------------------------------
  console.log('Scenario 2: Customer registration with mismatched passwords...');
  const custMismatchRes = await request('/auth/register/customer', {
    method: 'POST',
    body: {
      name: 'Mismatch User',
      email: `mismatch_${ts}@test.com`,
      password: strongPassword,
      confirmPassword: 'DifferentPassword2026!'
    }
  });

  if (custMismatchRes.status !== 400) {
    throw new Error(`Scenario 2 Failed: Expected 400 Bad Request, got ${custMismatchRes.status}`);
  }
  console.log(`   ✓ Mismatched password rejected with 400 Bad Request: "${custMismatchRes.data.message}"\n`);

  // -------------------------------------------------------------------------
  // Scenario 3: Weak password rejection
  // -------------------------------------------------------------------------
  console.log('Scenario 3: Weak password rejection...');
  const weakPasswords = [
    'short', // < 8 characters
    'alllowercase123!', // No uppercase
    'ALLUPPERCASE123!', // No lowercase
    'NoDigitsHere!', // No number
    'NoSpecialChar123' // No special char
  ];

  for (const wp of weakPasswords) {
    const res = await request('/auth/register/customer', {
      method: 'POST',
      body: {
        name: 'Weak Password Test',
        email: `weak_${Math.random().toString(36).substring(7)}_${ts}@test.com`,
        password: wp,
        confirmPassword: wp
      }
    });

    if (res.status !== 400) {
      throw new Error(`Scenario 3 Failed: Weak password "${wp}" was not rejected (Got ${res.status})`);
    }
  }
  console.log('   ✓ All 5 weak password variants rejected by backend validation.\n');

  // -------------------------------------------------------------------------
  // Scenario 4: Strong password acceptance
  // -------------------------------------------------------------------------
  console.log('Scenario 4: Strong password acceptance...');
  const strongVariants = [
    'ValidPass1@',
    'Secret#99Special',
    'P@ssw0rd2026Boutique'
  ];

  for (const sp of strongVariants) {
    const res = await request('/auth/register/customer', {
      method: 'POST',
      body: {
        name: 'Strong User',
        email: `strong_${Math.random().toString(36).substring(7)}_${ts}@test.com`,
        password: sp,
        confirmPassword: sp
      }
    });

    if (res.status !== 201) {
      throw new Error(`Scenario 4 Failed: Strong password "${sp}" failed registration (Got ${res.status})`);
    }
  }
  console.log('   ✓ Strong passwords conforming to all 5 criteria accepted.\n');

  // -------------------------------------------------------------------------
  // Scenario 5: Salon owner registration without a mobile number
  // -------------------------------------------------------------------------
  console.log('Scenario 5: Salon owner registration without a mobile number...');
  const noPhoneRes = await request('/auth/register/salon-owner', {
    method: 'POST',
    body: {
      name: 'Owner No Phone',
      email: `no_phone_${ts}@test.com`,
      password: strongPassword,
      confirmPassword: strongPassword,
      salonName: 'No Phone Salon',
      address: '100 Feet Road',
      city: 'Bengaluru',
      identityProof: {
        url: 'https://docs.aureliabeaute.internal/secure/id-docs/sample_gst.pdf',
        filename: 'gst_certificate.pdf',
        fileType: 'application/pdf',
        fileSize: 102400
      }
    }
  });

  if (noPhoneRes.status !== 400) {
    throw new Error(`Scenario 5 Failed: Expected 400 when phone number missing, got ${noPhoneRes.status}`);
  }
  console.log(`   ✓ Registration without mobile number rejected: "${noPhoneRes.data.message}"\n`);

  // -------------------------------------------------------------------------
  // Scenario 6: Salon owner registration without identity proof
  // -------------------------------------------------------------------------
  console.log('Scenario 6: Salon owner registration without identity proof...');
  const noDocRes = await request('/auth/register/salon-owner', {
    method: 'POST',
    body: {
      name: 'Owner No Doc',
      email: `no_doc_${ts}@test.com`,
      phone: '+91 98450 99887',
      password: strongPassword,
      confirmPassword: strongPassword,
      salonName: 'No Doc Salon',
      address: '100 Feet Road',
      city: 'Bengaluru'
    }
  });

  if (noDocRes.status !== 400) {
    throw new Error(`Scenario 6 Failed: Expected 400 when identityProof missing, got ${noDocRes.status}`);
  }
  console.log(`   ✓ Registration without identity proof rejected: "${noDocRes.data.message}"\n`);

  // -------------------------------------------------------------------------
  // Scenario 7: Unsupported identity document file rejection
  // -------------------------------------------------------------------------
  console.log('Scenario 7: Unsupported identity document file rejection...');
  const invalidDocRes = await request('/auth/register/salon-owner', {
    method: 'POST',
    body: {
      name: 'Owner Invalid Doc',
      email: `invalid_doc_${ts}@test.com`,
      phone: '+91 98450 99887',
      password: strongPassword,
      confirmPassword: strongPassword,
      salonName: 'Invalid Doc Salon',
      address: '100 Feet Road',
      city: 'Bengaluru',
      identityProof: {
        url: 'https://evil.internal/malware.exe',
        filename: 'malware.exe',
        fileType: 'application/x-msdownload',
        fileSize: 1024
      }
    }
  });

  if (invalidDocRes.status !== 400) {
    throw new Error(`Scenario 7 Failed: Expected 400 for unsupported file type .exe, got ${invalidDocRes.status}`);
  }

  // Also test upload-document endpoint with unsupported format
  const uploadInvalidRes = await request('/auth/upload-document', {
    method: 'POST',
    body: {
      filename: 'document.docx',
      fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    }
  });
  if (uploadInvalidRes.status !== 400) {
    throw new Error(`Scenario 7 Failed: upload-document endpoint allowed unsupported format (.docx)`);
  }
  console.log(`   ✓ Unsupported document formats (.exe, .docx) strictly rejected.\n`);

  // -------------------------------------------------------------------------
  // Scenario 8: Successful salon owner registration
  // -------------------------------------------------------------------------
  console.log('Scenario 8: Successful salon owner registration...');
  const ownerEmail = `elegance_owner_${ts}@test.com`;
  const ownerRegRes = await request('/auth/register/salon-owner', {
    method: 'POST',
    body: {
      name: 'Claire Dupont',
      email: ownerEmail,
      phone: '+91 98765 43210',
      password: strongPassword,
      confirmPassword: strongPassword,
      salonName: `Élégance Parisienne ${ts}`,
      address: '54 Vittal Mallya Road',
      city: 'Bengaluru',
      identityProof: {
        url: 'https://docs.aureliabeaute.internal/secure/id-docs/sample_trade_license.pdf',
        filename: 'trade_license.pdf',
        fileType: 'application/pdf',
        fileSize: 524288
      }
    }
  });

  if (ownerRegRes.status !== 201) {
    throw new Error(`Scenario 8 Failed: Expected 201, got ${ownerRegRes.status} (${JSON.stringify(ownerRegRes.data)})`);
  }
  const ownerToken = ownerRegRes.data.token;
  const ownerUser = ownerRegRes.data.user;
  const ownerSalon = ownerRegRes.data.salon;

  if (ownerUser.password || ownerUser.passwordHash) {
    throw new Error('Scenario 8 Failed: Password or passwordHash exposed in owner response');
  }
  if (!ownerUser.phone) {
    throw new Error('Scenario 8 Failed: Normalized phone number was not returned in user object');
  }
  console.log(`   ✓ Salon Owner and Salon registered successfully.`);
  console.log(`     - Owner: ${ownerUser.name} (${ownerUser.email}, ${ownerUser.phone})`);
  console.log(`     - Salon: ${ownerSalon.salonName} in ${ownerSalon.city}\n`);

  // -------------------------------------------------------------------------
  // Scenario 9: Salon owner remains pending admin approval
  // -------------------------------------------------------------------------
  console.log('Scenario 9: Salon owner remains pending admin approval...');
  if (ownerSalon.status !== 'PENDING_APPROVAL') {
    throw new Error(`Scenario 9 Failed: Expected status PENDING_APPROVAL, got "${ownerSalon.status}"`);
  }

  // Ensure unapproved salon is not discoverable in public marketplace
  const publicDiscoveryRes = await request(`/salons?q=${encodeURIComponent(`Élégance Parisienne ${ts}`)}`);
  const match = (publicDiscoveryRes.data.data || []).find((s: any) => s.id === ownerSalon.id);
  if (match) {
    throw new Error('Scenario 9 Failed: Unapproved salon was found in public active salon discovery!');
  }
  console.log(`   ✓ Newly registered salon is PENDING_APPROVAL and hidden from public discovery.\n`);

  // -------------------------------------------------------------------------
  // Scenario 10: Login displays the actual saved profile data
  // -------------------------------------------------------------------------
  console.log('Scenario 10: Login displays the actual saved profile data...');
  const custLoginRes = await request('/auth/login', {
    method: 'POST',
    body: { email: custEmail1, password: strongPassword }
  });
  if (custLoginRes.status !== 200) throw new Error('Customer login failed');
  const loggedCust = custLoginRes.data.user;
  if (loggedCust.name !== 'Sophia Laurent' || loggedCust.email !== custEmail1 || loggedCust.phone !== '+919845011223') {
    throw new Error(`Scenario 10 Failed: Customer login returned mismatched data: ${JSON.stringify(loggedCust)}`);
  }

  const ownerLoginRes = await request('/auth/login', {
    method: 'POST',
    body: { email: ownerEmail, password: strongPassword }
  });
  if (ownerLoginRes.status !== 200) throw new Error('Owner login failed');
  const loggedOwner = ownerLoginRes.data.user;
  if (loggedOwner.name !== 'Claire Dupont' || loggedOwner.email !== ownerEmail || loggedOwner.phone !== '+919876543210') {
    throw new Error(`Scenario 10 Failed: Owner login returned mismatched data: ${JSON.stringify(loggedOwner)}`);
  }
  console.log('   ✓ Login endpoint returns actual saved profile fields for customer and owner.\n');

  // -------------------------------------------------------------------------
  // Scenario 11: Missing profile fields show empty states instead of fake values
  // -------------------------------------------------------------------------
  console.log('Scenario 11: Missing profile fields show empty states instead of fake values...');
  // Customer registered without address or city
  const profileRes = await request('/profile/me', { token: custToken1 });
  if (profileRes.status !== 200) throw new Error('Failed to fetch customer profile');
  const userProf = profileRes.data.user;

  if (userProf.address !== undefined && userProf.address !== '') {
    throw new Error(`Scenario 11 Failed: Customer address had fake default value: "${userProf.address}"`);
  }
  if (userProf.city !== undefined && userProf.city !== '') {
    throw new Error(`Scenario 11 Failed: Customer city had fake default value: "${userProf.city}"`);
  }

  // Owner profile check for description
  const ownerProfRes = await request('/profile/me', { token: ownerToken });
  if (ownerProfRes.status !== 200) throw new Error('Failed to fetch owner profile');
  const ownerProf = ownerProfRes.data;

  if (ownerProf.salon.description !== '') {
    throw new Error(`Scenario 11 Failed: Salon description had fake default value: "${ownerProf.salon.description}"`);
  }
  console.log('   ✓ Profile records have no fake fallback strings (address: undefined, description: "").\n');

  // -------------------------------------------------------------------------
  // Scenario 12: Profile edits persist after logout and login
  // -------------------------------------------------------------------------
  console.log('Scenario 12: Profile edits persist after logout and login...');
  // Update customer profile
  const custUpdateRes = await request('/profile/me', {
    method: 'PUT',
    token: custToken1,
    body: {
      name: 'Sophia Laurent Updated',
      phone: '+91 99988 77766',
      address: 'Villa 12, Palm Meadows',
      city: 'Bengaluru'
    }
  });
  if (custUpdateRes.status !== 200) throw new Error(`Customer profile update failed: ${JSON.stringify(custUpdateRes.data)}`);

  // Update salon owner profile
  const ownerUpdateRes = await request('/profile/me', {
    method: 'PUT',
    token: ownerToken,
    body: {
      name: 'Claire Dupont-Moreau',
      phone: '+91 97777 66655',
      salonName: `Élégance Parisienne Flagship ${ts}`,
      address: 'Suite 201, UB City Collection',
      city: 'Bengaluru',
      description: 'Exclusive French luxury salon specializing in high-fashion balayage.'
    }
  });
  if (ownerUpdateRes.status !== 200) throw new Error(`Owner profile update failed: ${JSON.stringify(ownerUpdateRes.data)}`);

  // Customer logs out
  await request('/auth/logout', { method: 'POST', token: custToken1 });
  // Customer logs back in
  const reloginCust = await request('/auth/login', {
    method: 'POST',
    body: { email: custEmail1, password: strongPassword }
  });
  const newCustToken = reloginCust.data.token;
  const freshCustProf = await request('/profile/me', { token: newCustToken });

  if (
    freshCustProf.data.user.name !== 'Sophia Laurent Updated' ||
    freshCustProf.data.user.phone !== '+919998877766' ||
    freshCustProf.data.user.address !== 'Villa 12, Palm Meadows'
  ) {
    throw new Error(`Scenario 12 Failed: Customer profile edit did not persist: ${JSON.stringify(freshCustProf.data)}`);
  }

  // Owner logs back in
  const reloginOwner = await request('/auth/login', {
    method: 'POST',
    body: { email: ownerEmail, password: strongPassword }
  });
  const newOwnerToken = reloginOwner.data.token;
  const freshOwnerProf = await request('/profile/me', { token: newOwnerToken });

  if (
    freshOwnerProf.data.user.name !== 'Claire Dupont-Moreau' ||
    freshOwnerProf.data.salon.salonName !== `Élégance Parisienne Flagship ${ts}` ||
    freshOwnerProf.data.salon.description !== 'Exclusive French luxury salon specializing in high-fashion balayage.'
  ) {
    throw new Error(`Scenario 12 Failed: Owner profile edit did not persist: ${JSON.stringify(freshOwnerProf.data)}`);
  }
  console.log('   ✓ Profile edits persist across logout and relogin.\n');

  // -------------------------------------------------------------------------
  // Scenario 13: Unauthorized profile access is rejected
  // -------------------------------------------------------------------------
  console.log('Scenario 13: Unauthorized profile access is rejected...');
  // 1. Unauthenticated request to /profile/me
  const unauthRes = await request('/profile/me');
  if (unauthRes.status !== 401) {
    throw new Error(`Scenario 13 Failed: Expected 401 for unauthenticated profile access, got ${unauthRes.status}`);
  }

  // 2. Customer attempting to access owner profile endpoint
  const roleCrossRes = await request('/owner/profile', { token: newCustToken });
  if (roleCrossRes.status !== 403) {
    throw new Error(`Scenario 13 Failed: Expected 403 when Customer accesses /owner/profile, got ${roleCrossRes.status}`);
  }

  // 3. User attempting to alter their role via profile update
  const roleEscalateRes = await request('/profile/me', {
    method: 'PUT',
    token: newCustToken,
    body: { role: 'SUPER_ADMIN' }
  });
  if (roleEscalateRes.status !== 403) {
    throw new Error(`Scenario 13 Failed: Expected 403 when attempting to change role, got ${roleEscalateRes.status}`);
  }
  console.log('   ✓ Unauthorized requests and role escalation attempts strictly rejected.\n');

  // -------------------------------------------------------------------------
  // Scenario 14: Existing login and booking functionality still work
  // -------------------------------------------------------------------------
  console.log('Scenario 14: Existing login and booking functionality still work...');
  // Login super admin
  const adminRes = await request('/auth/login', {
    method: 'POST',
    body: { email: 'admin@example.com', password: 'AdminPassword123!' }
  });
  if (adminRes.status !== 200) throw new Error('Super admin login failed');
  const adminToken = adminRes.data.token;

  // Add services & subscription to owner's salon, then approve
  await request('/owner/salon', {
    method: 'POST',
    token: newOwnerToken,
    body: {
      salonName: `Élégance Parisienne Flagship ${ts}`,
      description: 'Exclusive French luxury salon specializing in high-fashion balayage.',
      phone: '+91 97777 66655',
      email: ownerEmail,
      address: 'Suite 201, UB City Collection',
      city: 'Bengaluru',
      services: [
        { name: 'French Balayage', category: 'Hair', price: 4000, durationMinutes: 90, description: 'Couture hair color' }
      ]
    }
  });

  await request('/owner/subscription/mock-checkout', {
    method: 'POST',
    token: newOwnerToken,
    body: { plan: 'BUSINESS', billingCycle: 'YEARLY' }
  });

  const approveRes = await request(`/admin/salons/${ownerSalon.id}/approve`, {
    method: 'PATCH',
    token: adminToken
  });
  if (approveRes.status !== 200) throw new Error('Admin approve salon failed');

  // Fetch standalone services for this salon
  const servRes = await request(`/salons/${ownerSalon.id}/services`);
  if (servRes.status !== 200 || !servRes.data.data?.length) {
    throw new Error('Failed to fetch services for salon');
  }
  const chosenService = servRes.data.data[0];

  // Customer books appointment
  const bookRes = await request('/customer/appointments', {
    method: 'POST',
    token: newCustToken,
    body: {
      salonId: ownerSalon.id,
      serviceId: chosenService.id || chosenService._id,
      appointmentDate: '2026-10-15',
      startTime: '10:00',
      customerNote: 'First time visiting'
    }
  });

  if (bookRes.status !== 201) {
    throw new Error(`Scenario 14 Failed: Booking creation failed with status ${bookRes.status}: ${JSON.stringify(bookRes.data)}`);
  }
  console.log(`   ✓ Appointment booked successfully (ID: ${bookRes.data.appointment._id}, Status: ${bookRes.data.appointment.status}).\n`);

  console.log('========================================================================');
  console.log('  🎉 ALL 14 PHASE 15 INTEGRATION TEST SCENARIOS PASSED WITH 100%!       ');
  console.log('========================================================================');
}

run().catch((err) => {
  console.error('\n❌ PHASE 15 TEST FAILED:', err);
  process.exit(1);
});
