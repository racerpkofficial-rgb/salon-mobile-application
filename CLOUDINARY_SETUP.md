# Cloudinary File Storage Setup & Architecture Guide

This document outlines the architecture, environment variables, Vercel configuration, and verification steps for Cloudinary file storage across the **Book My Salon** backend (`apps/api`) and Expo React Native mobile application (`apps/mobile`).

---

## 1. Required Environment Variables

Set the following environment variables in your backend environment:

| Variable Name | Required | Description | Scope |
| :--- | :--- | :--- | :--- |
| `CLOUDINARY_CLOUD_NAME` | **Yes** | Your Cloudinary Cloud Name (e.g. `dxy...`) | Backend only (`apps/api/.env` & Vercel) |
| `CLOUDINARY_API_KEY` | **Yes** | Cloudinary API Key | Backend only (`apps/api/.env` & Vercel) |
| `CLOUDINARY_API_SECRET` | **Yes** | Cloudinary API Secret | **Backend only! NEVER expose to client!** |

> [!CAUTION]
> **Security Requirement**: `CLOUDINARY_API_SECRET` must **never** be exposed in the mobile application code, git repository, client bundles, API response payloads, or public logs. All uploads and signatures are validated and generated securely on the backend server.

---

## 2. Vercel Configuration & Serverless Limits

The Book My Salon API is hosted on Vercel Serverless Functions (`apps/api/vercel.json`).

### A. Environment Variables in Vercel Dashboard
1. Open your Vercel Dashboard: [https://vercel.com/dashboard](https://vercel.com/dashboard).
2. Select your project: `salon-mobile-application`.
3. Navigate to **Settings** -> **Environment Variables**.
4. Add the three keys:
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`
5. Select environments: **Production**, **Preview**, and **Development**.
6. Trigger a redeployment or push to `main` so the new environment variables take effect.

### B. Vercel 4.5MB Payload Limit & Upload Strategy
Vercel serverless functions enforce a strict **4.5MB maximum HTTP request body limit** (`FUNCTION_PAYLOAD_TOO_LARGE` / HTTP 413).
- **Mobile Compression**: The mobile app's image picker (`ImagePicker.launchImageLibraryAsync`) compresses photos (`quality: 0.7 - 0.8`), which produces high-fidelity photos between 400KB and 1.2MB, well below Vercel's limit.
- **Backend Size Validation**: Upload endpoints validate base64 lengths and file sizes before processing. Large uncompressed files (> 5MB) are rejected with clear error messages.
- **Direct Signed Upload Support**: An authenticated signature endpoint `GET /api/v1/owner/upload-signature` is available for direct client-to-Cloudinary uploads when handling larger media, bypassing the Vercel function payload ceiling.

---

## 3. Storage Hierarchy & Folders

Assets are organized into isolated folder structures by entity and owner:

| Asset Type | Cloudinary Folder | Resource Type | Delivery Mode | Access Control |
| :--- | :--- | :--- | :--- | :--- |
| **Salon Gallery Photos** | `aurelia-salons/{ownerId}` | `image` | `upload` (Public CDN) | Salon Owner only |
| **Profile Avatars** | `aurelia-profiles/{userId}` | `image` | `upload` (Public CDN) | Authenticated User only |
| **Offer Banners** | `aurelia-offers/{salonId}` | `image` | `upload` (Public CDN) | Salon Owner only |
| **Identity Proof Documents** | `aurelia-identity-docs` | `raw` (PDF) / `image` | `authenticated` (Private) | **Restricted / Signed URL Only** |

---

## 4. Sensitive Document Privacy & Delivery Strategy

Identity proof documents (government IDs, trade licenses, certificates) can contain sensitive personal identification data.

1. **Private Storage**: Documents are uploaded with `type: 'authenticated'` and stored under `aurelia-identity-docs`. Cloudinary restricts direct unauthenticated access to these assets (direct URL visits return HTTP 401/404).
2. **Database Masking**: The `identityProof` field in MongoDB Atlas `Salon` schema uses `select: false`. It is completely omitted from public discovery endpoints (`/salons`, `/salons/:id`, `/salons/offers`).
3. **Signed Temporary Delivery**:
   - **Salon Owner**: `GET /api/v1/owner/salon/document` verifies the caller's owner ID and returns a temporary signed URL valid for 1 hour.
   - **Super Admin**: `GET /api/v1/admin/salons/:id/document` and `GET /api/v1/admin/salons/:id` generate secure time-limited signed URLs (`sign_url: true`, expires in 1 hour) specifically for registration review.

---

## 5. Duplicate Upload Prevention & Safe Asset Cleanup

To keep Cloudinary storage lean and avoid abandoned orphan files:
1. **Avatar Replacement**: When a user uploads a new avatar via `POST /api/v1/profile/upload-photo` or updates via `PUT /api/v1/profile/me`, the previous avatar is automatically deleted from Cloudinary **after** the database record is updated.
2. **Salon Gallery Editing**: When an owner removes photos from their gallery via `PATCH /api/v1/owner/salon/images` or `PUT /api/v1/profile/me`, the removed URLs are purged from Cloudinary.
3. **Offer Deletion / Update**: When an offer is deleted via `DELETE /api/v1/owner/offers/:id` or its banner is replaced, the old asset is purged.
4. **Ownership Verification**: Deletions check that the asset public ID begins with the expected user/salon prefix (`requiredPrefix`). Users cannot delete other accounts' assets.

---

## 6. Step-by-Step Instructions: Test Salon Photo Upload & Verify MongoDB Atlas

Follow these steps to upload a salon photo and verify that MongoDB Atlas stores the URL and identifier:

### Step 1: Ensure Server is Running
```bash
cd apps/api
npm run dev
```

### Step 2: Run the Cloudinary Integration Suite
```bash
npm run test:cloudinary
```
This automated suite verifies:
1. Image MIME type validation (JPEG/PNG/WebP accepted, text/HTML rejected).
2. PDF identity proof upload with `resource_type: 'raw'` and `type: 'authenticated'`.
3. Signed URL generation for private identity documents.
4. Salon photo upload via `POST /api/v1/owner/upload`.
5. Persistence of the Cloudinary URL in MongoDB Atlas `Salon.images`.
6. Access control on `/owner/salon/document` and `/admin/salons/:id/document`.
7. Profile avatar replacement and cleanup.

### Step 3: Manual Test via cURL / Postman

1. **Login as Salon Owner**:
```bash
curl -X POST http://127.0.0.1:4000/api/v1/auth/salon-owner/login \
  -H "Content-Type: application/json" \
  -d '{"email": "your-owner@example.com", "password": "YourPassword123!"}'
```
Copy the returned `token`.

2. **Upload a Salon Photo**:
```bash
curl -X POST http://127.0.0.1:4000/api/v1/owner/upload \
  -H "Authorization: Bearer <YOUR_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="}'
```
Response:
```json
{
  "url": "https://res.cloudinary.com/.../aurelia-salons/.../img_123.png",
  "secureUrl": "https://res.cloudinary.com/.../aurelia-salons/.../img_123.png",
  "publicId": "aurelia-salons/.../img_123"
}
```

3. **Save Image to Salon Gallery**:
```bash
curl -X PATCH http://127.0.0.1:4000/api/v1/owner/salon/images \
  -H "Authorization: Bearer <YOUR_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"images": ["https://res.cloudinary.com/.../aurelia-salons/.../img_123.png"]}'
```

4. **Verify MongoDB Atlas Persistence**:
Query your salon document using mongosh or via API:
```bash
curl -X GET http://127.0.0.1:4000/api/v1/owner/salon \
  -H "Authorization: Bearer <YOUR_TOKEN>"
```
The response will show:
```json
{
  "hasSalon": true,
  "salon": {
    "images": [
      "https://res.cloudinary.com/.../aurelia-salons/.../img_123.png"
    ]
  }
}
```
Existing bookings, reviews, subscriptions, and salon data in MongoDB Atlas remain intact and untouched.
