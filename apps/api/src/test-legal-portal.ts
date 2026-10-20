/**
 * Automated test suite for BookMy Salon Legal Portal & Public URLs
 */

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:4000';

async function runLegalPortalTests() {
  console.log('=== STARTING BOOKMY SALON LEGAL PORTAL VERIFICATION ===');
  console.log(`Testing target URL: ${BASE_URL}\n`);

  let passed = 0;
  let failed = 0;

  async function testEndpoint(name: string, path: string, expectedText: string, expectedStatus = 200) {
    try {
      const res = await fetch(`${BASE_URL}${path}`);
      if (res.status !== expectedStatus) {
        console.error(`❌ FAIL [${res.status}] ${name} — Expected status ${expectedStatus}`);
        failed++;
        return;
      }

      const text = await res.text();
      if (!text.includes(expectedText)) {
        console.error(`❌ FAIL ${name} — Did not find expected text snippet: "${expectedText}"`);
        failed++;
        return;
      }

      console.log(`✓ PASS [${res.status}] ${name} (Contains: "${expectedText}")`);
      passed++;
    } catch (err) {
      console.error(`❌ FAIL ${name} — Network error:`, (err as Error).message);
      failed++;
    }
  }

  // 1. Hub Portal
  await testEndpoint('Portal Hub (GET /)', '/', 'BookMy Salon Legal Portal');

  // 2. Terms & Conditions Direct URL
  await testEndpoint('Terms & Conditions (GET /terms)', '/terms', 'Terms & Conditions');
  await testEndpoint('Terms Section 07 Plans (GET /terms)', '/terms', 'STARTER');
  await testEndpoint('Terms Contact Desk (GET /terms)', '/terms', 'bookmysalonadmin@gmail.com');

  // 3. Privacy Policy Direct URL
  await testEndpoint('Privacy Policy (GET /privacy)', '/privacy', 'Privacy Policy');
  await testEndpoint('Privacy Third Parties (GET /privacy)', '/privacy', 'Razorpay');
  await testEndpoint('Privacy Deletion (GET /privacy)', '/privacy', 'Self-Service Account Deletion');

  // 4. Stylesheet
  await testEndpoint('Vanilla Stylesheet (GET /styles.css)', '/styles.css', '--gold-primary: #C69232');

  // 5. Official Logo Asset
  try {
    const logoRes = await fetch(`${BASE_URL}/assets/logo.png`);
    if (logoRes.status === 200 && (logoRes.headers.get('content-type') || '').includes('image')) {
      console.log('✓ PASS [200] Official Logo Asset (GET /assets/logo.png)');
      passed++;
    } else {
      console.error(`❌ FAIL Logo asset returned status ${logoRes.status}`);
      failed++;
    }
  } catch (e) {
    console.error('❌ FAIL Logo asset fetch error:', e);
    failed++;
  }

  console.log('\n=== LEGAL PORTAL TEST SUMMARY ===');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('\n🎉 ALL LEGAL PORTAL VERIFICATIONS PASSED PERFECTLY!\n');
    process.exit(0);
  }
}

runLegalPortalTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
