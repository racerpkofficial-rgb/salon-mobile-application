import { app } from './application.js';
import http from 'http';
import mongoose from 'mongoose';
import { env } from './config/env.js';

async function runMultipartTest() {
  console.log('--- TESTING MULTIPART FORM-DATA PDF UPLOAD ---');
  await mongoose.connect(env.MONGODB_URI);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}/api/v1`;

  try {
    // 1. Test multipart/form-data PDF upload
    const samplePdfContent = '%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF';
    const pdfBlob = new Blob([Buffer.from(samplePdfContent, 'utf-8')], { type: 'application/pdf' });

    const formData = new FormData();
    formData.append('document', pdfBlob, 'registration-certificate.pdf');
    formData.append('filename', 'registration-certificate.pdf');
    formData.append('fileType', 'application/pdf');

    const res = await fetch(`${baseUrl}/auth/upload-document`, {
      method: 'POST',
      body: formData
    });

    const data = await res.json();
    console.log('Upload response status:', res.status);
    console.log('Upload response data:', data);

    if (res.status !== 200 || !data.url || !data.filename.endsWith('.pdf')) {
      throw new Error(`Multipart PDF upload failed: ${JSON.stringify(data)}`);
    }

    console.log('✓ Multipart PDF upload succeeded with Cloudinary URL:', data.url);

    // 2. Test rejection of disallowed format (e.g. .exe)
    const badBlob = new Blob(['bad binary'], { type: 'application/x-msdownload' });
    const badFormData = new FormData();
    badFormData.append('document', badBlob, 'malicious.exe');
    badFormData.append('filename', 'malicious.exe');
    badFormData.append('fileType', 'application/x-msdownload');

    const badRes = await fetch(`${baseUrl}/auth/upload-document`, {
      method: 'POST',
      body: badFormData
    });
    console.log('Bad file upload status (expected 400):', badRes.status);
    if (badRes.status !== 400) {
      throw new Error(`Expected 400 for bad file format, got ${badRes.status}`);
    }
    console.log('✓ Disallowed file format correctly rejected (400)');

    // 3. Test backward compatibility: JSON body base64 upload
    const jsonRes = await fetch(`${baseUrl}/auth/upload-document`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: 'legacy-test.pdf',
        fileType: 'application/pdf',
        fileData: `data:application/pdf;base64,${Buffer.from(samplePdfContent).toString('base64')}`,
        fileSize: 1024
      })
    });
    const jsonData = await jsonRes.json();
    console.log('Legacy JSON upload status (expected 200):', jsonRes.status);
    if (jsonRes.status !== 200 || !jsonData.url) {
      throw new Error(`Legacy JSON upload failed: ${JSON.stringify(jsonData)}`);
    }
    console.log('✓ Legacy JSON base64 upload succeeded backward compatibility');

    console.log('🎉 ALL MULTIPART AND BACKWARD COMPATIBILITY TESTS PASSED!');
  } finally {
    server.close();
    await mongoose.disconnect();
  }
}

runMultipartTest().catch((err) => {
  console.error('Multipart test error:', err);
  process.exit(1);
});
