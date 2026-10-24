import mongoose from 'mongoose';
import { app } from './application.js';
import { env } from './config/env.js';
import { User } from './models/User.js';
import { Salon } from './models/Salon.js';
import { SalonOffer } from './models/SalonOffer.js';
import { cloudinaryService } from './services/cloudinary.service.js';
import type { Server } from 'http';

let server: Server;
let baseUrl: string;

async function request(path: string, options: { method?: string; body?: any; token?: string } = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}

// 1x1 transparent PNG as base64 data URI
const samplePngBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const samplePdfBase64 = 'data:application/pdf;base64,JVBERi0xLjQKJcOkw7zDtsOfCjEgMCBvYmoKPDwvVHlwZS9DYXRhbG9nL1BhZ2VzIDIgMCBSPj4KZW5kb2JqCjIgMCBvYmoKPDwvVHlwZS9QYWdlcy9LaWRzWzMgMCBSXS9Db3VudCAxPj4KZW5kb2JqCjMgMCBvYmoKPDwvVHlwZS9QYWdlL1BhcmVudCAyIDAgUi9NZWRpYUJveFswIDAgNjEyIDc5Ml0+PgplbmRvYmoKeHJlZgowIDQKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDE4IDAwMDAwIG4gCjAwMDAwMDAwNjYgMDAwMDAgbiAKMDAwMDAwMDExNSAwMDAwMCBuIAp0cmFpbGVyCjw8L1NpemUgND4+CnN0YXJ0eHJlZgoxNzEKJSVFT0YK';

async function runTest() {
  console.log('========================================================================');
  console.log('         VERIFYING CLOUDINARY FILE STORAGE & UPLOAD INTEGRATION         ');
  console.log('========================================================================\n');

  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(env.MONGODB_URI);
  console.log('Connected to MongoDB.');

  // Start Express app on random available port
  server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const addr = server.address() as any;
  baseUrl = `http://127.0.0.1:${addr.port}/api/v1`;
  console.log(`Test API Server running on ${baseUrl}\n`);

  const ts = Date.now();
  const password = 'Password123!';

  // ========================================================
  // 1. Reusable Cloudinary Service Unit Checks
  // ========================================================
  console.log('1. Testing Cloudinary Service unit functionality...');

  // 1a. uploadImage validation
  try {
    await cloudinaryService.uploadImage('data:text/plain;base64,SGVsbG8=');
    throw new Error('Should have thrown on text/plain MIME type');
  } catch (err: any) {
    if (!err.message.includes('Invalid image format')) throw err;
    console.log('✓ Rejected disallowed MIME type (text/plain)');
  }

  // 1b. uploadImage success
  const imgRes = await cloudinaryService.uploadImage(samplePngBase64, {
    folder: 'aurelia-salons/test-owner'
  });
  if (!imgRes.url || !imgRes.publicId) {
    throw new Error(`Failed to upload image: ${JSON.stringify(imgRes)}`);
  }
  console.log(`✓ Image uploaded successfully: publicId = ${imgRes.publicId}`);

  // 1c. uploadDocument with PDF
  const docRes = await cloudinaryService.uploadDocument(samplePdfBase64, {
    filename: 'business_license.pdf',
    fileType: 'application/pdf',
    fileSize: 512
  });
  if (!docRes.url || !docRes.publicId || docRes.resourceType !== 'raw') {
    throw new Error(`Failed to upload PDF document: ${JSON.stringify(docRes)}`);
  }
  console.log(`✓ PDF document uploaded successfully: publicId = ${docRes.publicId}, resourceType = ${docRes.resourceType}`);

  // 1d. generatePrivateDocumentUrl
  const signedUrl = cloudinaryService.generatePrivateDocumentUrl(docRes.publicId, {
    resourceType: 'raw',
    expiresInSeconds: 1800
  });
  if (!signedUrl || signedUrl.length === 0) {
    throw new Error('generatePrivateDocumentUrl returned empty URL');
  }
  console.log(`✓ Generated private document signed URL (${signedUrl.slice(0, 50)}...)`);

  // 1e. extractPublicId
  const extracted = cloudinaryService.extractPublicId(
    'https://res.cloudinary.com/testcloud/image/upload/v1612345678/aurelia-salons/owner123/sample_photo.jpg'
  );
  if (extracted !== 'aurelia-salons/owner123/sample_photo') {
    throw new Error(`extractPublicId failed: expected "aurelia-salons/owner123/sample_photo", got "${extracted}"`);
  }
  console.log('✓ extractPublicId accurately extracted Cloudinary public ID');

  // 1f. deleteAsset with ownership verification
  const blockedDelete = await cloudinaryService.deleteAsset('aurelia-salons/other-owner/photo123', {
    requiredPrefix: 'aurelia-salons/my-owner-id'
  });
  if (blockedDelete !== false) {
    throw new Error('deleteAsset should have blocked deletion for mismatched owner prefix');
  }
  console.log('✓ deleteAsset prevented unauthorized deletion of another user\'s asset');

  // ========================================================
  // 2. Identity Document Upload & Owner Registration Flow
  // ========================================================
  console.log('\n2. Testing Identity Document Upload & Registration flow...');

  const docUploadRes = await request('/auth/upload-document', {
    method: 'POST',
    body: {
      filename: 'aadhaar_front.png',
      fileType: 'image/png',
      fileSize: 1024,
      fileData: samplePngBase64
    }
  });

  if (!docUploadRes.ok || !docUploadRes.data.url) {
    throw new Error(`Upload document API failed: ${JSON.stringify(docUploadRes.data)}`);
  }
  console.log(`✓ POST /auth/upload-document succeeded: ${docUploadRes.data.url}`);

  const ownerEmail = `cloud_owner_${ts}@test.com`;
  const ownerReg = await request('/auth/register/salon-owner', {
    method: 'POST',
    body: {
      name: 'Ananya Roy',
      email: ownerEmail,
      phone: '+91 98888 77777',
      password,
      confirmPassword: password,
      salonName: `Aura Salon ${ts}`,
      address: '77 Residency Road',
      city: 'Bengaluru',
      identityProof: {
        url: docUploadRes.data.url,
        filename: docUploadRes.data.filename,
        fileType: docUploadRes.data.fileType,
        fileSize: docUploadRes.data.fileSize
      }
    }
  });

  if (!ownerReg.ok) {
    throw new Error(`Owner registration failed: ${JSON.stringify(ownerReg.data)}`);
  }
  const ownerToken = ownerReg.data.token;
  const salonId = ownerReg.data.salon?.id || ownerReg.data.salon?._id;
  console.log(`✓ Owner registered with identity proof attached. Salon ID: ${salonId}`);

  // Verify MongoDB stores identityProof in DB (with select: false, but queryable with +identityProof)
  const salonFromDb = await Salon.findById(salonId).select('+identityProof').lean();
  if (!salonFromDb?.identityProof?.url) {
    throw new Error('Salon record in MongoDB missing identityProof url');
  }
  console.log(`✓ Verified MongoDB stores identity proof URL: ${salonFromDb.identityProof.url}`);

  // ========================================================
  // 3. Salon Owner Image Upload & Gallery Persistence
  // ========================================================
  console.log('\n3. Testing Salon Photo Upload & Gallery persistence in MongoDB...');

  const uploadPhotoRes = await request('/owner/upload', {
    method: 'POST',
    token: ownerToken,
    body: {
      image: samplePngBase64,
      fileType: 'image/png'
    }
  });

  if (!uploadPhotoRes.ok || !uploadPhotoRes.data.url) {
    throw new Error(`Owner upload photo failed: ${JSON.stringify(uploadPhotoRes.data)}`);
  }
  const uploadedSalonPhotoUrl = uploadPhotoRes.data.secureUrl || uploadPhotoRes.data.url;
  console.log(`✓ Salon photo uploaded via POST /owner/upload: ${uploadedSalonPhotoUrl}`);

  // Save photo to salon gallery
  const updateGalleryRes = await request('/owner/salon/images', {
    method: 'PATCH',
    token: ownerToken,
    body: {
      images: [uploadedSalonPhotoUrl]
    }
  });

  if (!updateGalleryRes.ok) {
    throw new Error(`Update salon images failed: ${JSON.stringify(updateGalleryRes.data)}`);
  }
  console.log('✓ Salon gallery updated with uploaded photo.');

  // Verify in MongoDB Atlas
  const updatedSalonDb = await Salon.findById(salonId).lean();
  if (!updatedSalonDb?.images?.includes(uploadedSalonPhotoUrl)) {
    throw new Error(`MongoDB does not contain uploaded photo URL in images array: ${JSON.stringify(updatedSalonDb?.images)}`);
  }
  console.log(`✓ Verified in MongoDB Atlas: Salon.images contains ${uploadedSalonPhotoUrl}`);

  // ========================================================
  // 4. Secure Identity Document Access via Signed URLs
  // ========================================================
  console.log('\n4. Testing Secure Identity Document access and permissions...');

  // 4a. Owner accesses their own identity document
  const ownerDocRes = await request('/owner/salon/document', {
    token: ownerToken
  });
  if (!ownerDocRes.ok || !ownerDocRes.data.document?.signedUrl) {
    throw new Error(`Owner document access failed: ${JSON.stringify(ownerDocRes.data)}`);
  }
  console.log(`✓ Salon Owner retrieved secure signed document URL: ${ownerDocRes.data.document.signedUrl.slice(0, 60)}...`);

  // 4b. Super Admin accesses salon identity document
  const adminLogin = await request('/auth/login', {
    method: 'POST',
    body: { email: env.SUPER_ADMIN_EMAIL || 'admin@example.com', password: env.SUPER_ADMIN_PASSWORD || 'AdminPassword123!' }
  });
  if (!adminLogin.ok) throw new Error(`Admin login failed: ${JSON.stringify(adminLogin.data)}`);
  const adminToken = adminLogin.data.token;

  const adminDocRes = await request(`/admin/salons/${salonId}/document`, {
    token: adminToken
  });
  if (!adminDocRes.ok || !adminDocRes.data.document?.signedUrl) {
    throw new Error(`Admin document access failed: ${JSON.stringify(adminDocRes.data)}`);
  }
  console.log(`✓ Super Admin retrieved secure signed document URL for verification: ${adminDocRes.data.document.signedUrl.slice(0, 60)}...`);

  // 4c. Customer cannot access owner document endpoint (Role protection)
  const custReg = await request('/auth/register/customer', {
    method: 'POST',
    body: {
      name: 'Riya Sen',
      email: `cust_${ts}@test.com`,
      phone: '+91 97777 66666',
      password,
      confirmPassword: password
    }
  });
  const custToken = custReg.data.token;
  await User.updateOne({ email: `cust_${ts}@test.com` }, { isEmailVerified: true });

  const forbiddenOwnerDoc = await request('/owner/salon/document', { token: custToken });
  if (forbiddenOwnerDoc.status !== 403) {
    throw new Error(`Expected 403 Forbidden for Customer accessing /owner/salon/document, got ${forbiddenOwnerDoc.status}`);
  }
  console.log('✓ Customer strictly forbidden (403) from accessing owner document route.');

  // ========================================================
  // 5. Offer Image Upload & Persistence
  // ========================================================
  console.log('\n5. Testing Offer Image Upload and Persistence...');

  const offerUploadRes = await request('/owner/offers/upload', {
    method: 'POST',
    token: ownerToken,
    body: {
      imageData: samplePngBase64,
      fileType: 'image/png'
    }
  });
  if (!offerUploadRes.ok || !offerUploadRes.data.url) {
    throw new Error(`Offer image upload failed: ${JSON.stringify(offerUploadRes.data)}`);
  }
  const offerImageUrl = offerUploadRes.data.secureUrl || offerUploadRes.data.url;
  console.log(`✓ Offer image uploaded via POST /owner/offers/upload: ${offerImageUrl}`);

  const offerCreateRes = await request('/owner/offers', {
    method: 'POST',
    token: ownerToken,
    body: {
      title: 'Summer Glow Package',
      description: 'Special summer discount on all beauty treatments',
      discountType: 'PERCENTAGE',
      discountValue: 25,
      applicableService: 'ALL',
      endDate: new Date(Date.now() + 10 * 86400000).toISOString(),
      image: offerImageUrl,
      isActive: true
    }
  });
  if (!offerCreateRes.ok) throw new Error(`Create offer failed: ${JSON.stringify(offerCreateRes.data)}`);
  const offerId = offerCreateRes.data.offer?._id || offerCreateRes.data.offer?.id;
  console.log(`✓ Offer created with ID: ${offerId}`);

  // Verify in MongoDB Atlas
  const offerDb = await SalonOffer.findById(offerId).lean();
  if (offerDb?.image !== offerImageUrl) {
    throw new Error(`MongoDB does not contain offer image: expected "${offerImageUrl}", got "${offerDb?.image}"`);
  }
  console.log(`✓ Verified in MongoDB Atlas: SalonOffer.image correctly stores ${offerImageUrl}`);

  // ========================================================
  // 6. User Profile Avatar Upload & Safe Replacement Cleanup
  // ========================================================
  console.log('\n6. Testing Profile Photo Upload & Replacement Cleanup...');

  const avatarRes = await request('/profile/upload-photo', {
    method: 'POST',
    token: custToken,
    body: {
      imageData: samplePngBase64
    }
  });
  if (!avatarRes.ok || !avatarRes.data.url) {
    throw new Error(`Profile photo upload failed: ${JSON.stringify(avatarRes.data)}`);
  }
  const firstAvatarUrl = avatarRes.data.url;
  console.log(`✓ Customer avatar uploaded: ${firstAvatarUrl}`);

  // Verify in MongoDB User record
  const customerUserDb = await User.findById(custReg.data.user?.id).lean();
  if (customerUserDb?.avatar !== firstAvatarUrl) {
    throw new Error(`MongoDB User.avatar mismatch: expected "${firstAvatarUrl}", got "${customerUserDb?.avatar}"`);
  }
  console.log(`✓ Verified in MongoDB Atlas: User.avatar matches ${firstAvatarUrl}`);

  // Replace avatar with second upload and verify update
  const secondAvatarRes = await request('/profile/upload-photo', {
    method: 'POST',
    token: custToken,
    body: {
      imageData: samplePngBase64
    }
  });
  if (!secondAvatarRes.ok) throw new Error(`Second avatar upload failed: ${JSON.stringify(secondAvatarRes.data)}`);
  const secondAvatarUrl = secondAvatarRes.data.url;
  console.log(`✓ Customer avatar replaced with new photo: ${secondAvatarUrl}`);

  const refreshedCustomerDb = await User.findById(custReg.data.user?.id).lean();
  if (refreshedCustomerDb?.avatar !== secondAvatarUrl) {
    throw new Error(`MongoDB User.avatar after replacement mismatch: got "${refreshedCustomerDb?.avatar}"`);
  }
  console.log(`✓ Verified in MongoDB Atlas: User.avatar updated to new image without duplicate record.`);

  // Cleanup test documents from database to leave DB pristine
  await Salon.deleteOne({ _id: salonId });
  await SalonOffer.deleteOne({ _id: offerId });
  await User.deleteOne({ email: ownerEmail });
  await User.deleteOne({ email: `cust_${ts}@test.com` });

  console.log('\n========================================================================');
  console.log('   🎉 ALL CLOUDINARY FILE STORAGE & UPLOAD VERIFICATIONS PASSED!       ');
  console.log('========================================================================\n');

  server.close();
  await mongoose.disconnect();
}

runTest().catch(async (err) => {
  console.error('\n❌ CLOUDINARY INTEGRATION TEST FAILED:', err);
  if (server) server.close();
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
