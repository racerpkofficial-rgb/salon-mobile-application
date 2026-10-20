import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env.js';

let isConfigured = false;
if (env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true
  });
  isConfigured = true;
}

export const cloudinaryService = {
  isAvailable(): boolean {
    return isConfigured;
  },

  /**
   * Upload an image to Cloudinary (base64 string, file path, or remote URL).
   */
  async uploadImage(
    fileData: string,
    options: { folder?: string; publicId?: string } = {}
  ): Promise<{ url: string; secureUrl: string; publicId: string }> {
    if (!fileData || typeof fileData !== 'string') {
      throw new Error('Image data is required for upload.');
    }

    // Validate data URI format and mime type if provided
    if (fileData.startsWith('data:')) {
      const mimeMatch = fileData.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,/);
      if (mimeMatch) {
        const mime = mimeMatch[1].toLowerCase();
        const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
        if (!allowedMimes.includes(mime)) {
          throw new Error('Invalid image format. Allowed formats: JPEG, PNG, WebP.');
        }
      }
    }

    if (!isConfigured) {
      // In development / demo mode when Cloudinary keys are not provided,
      // return the actual uploaded image data rather than inventing an external photograph
      const mockId = `offer_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      return {
        url: fileData,
        secureUrl: fileData,
        publicId: mockId
      };
    }

    const res = await cloudinary.uploader.upload(fileData, {
      folder: options.folder || 'aurelia-salons',
      public_id: options.publicId,
      transformation: [
        { width: 1200, height: 800, crop: 'limit' },
        { quality: 'auto', fetch_format: 'auto' }
      ]
    });

    return {
      url: res.url,
      secureUrl: res.secure_url,
      publicId: res.public_id
    };
  },

  /**
   * Upload an identity proof document with format & size verification.
   * Uses authenticated / private storage delivery.
   */
  async uploadDocument(
    fileData: string,
    metadata: { filename: string; fileType: string; fileSize?: number; folder?: string }
  ): Promise<{ url: string; secureUrl: string; publicId: string; filename: string; fileType: string; fileSize?: number }> {
    const allowedMime = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    const allowedExts = ['.jpg', '.jpeg', '.png', '.pdf'];
    const ext = metadata.filename.toLowerCase().slice(metadata.filename.lastIndexOf('.'));
    const isMimeOk = allowedMime.includes(metadata.fileType.toLowerCase());
    const isExtOk = allowedExts.includes(ext);

    if (!isMimeOk && !isExtOk) {
      throw new Error('Unsupported document format. Allowed formats: JPG, PNG, PDF');
    }

    if (metadata.fileSize && metadata.fileSize > 10 * 1024 * 1024) {
      throw new Error('Document file size exceeds 10MB limit');
    }

    const docId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    if (!isConfigured) {
      return {
        url: fileData.startsWith('http')
          ? fileData
          : `https://docs.aureliabeaute.internal/secure/id-docs/${docId}_${encodeURIComponent(metadata.filename)}`,
        secureUrl: fileData.startsWith('http')
          ? fileData
          : `https://docs.aureliabeaute.internal/secure/id-docs/${docId}_${encodeURIComponent(metadata.filename)}`,
        publicId: docId,
        filename: metadata.filename,
        fileType: metadata.fileType,
        fileSize: metadata.fileSize
      };
    }

    const isPdf = metadata.fileType.includes('pdf') || ext === '.pdf';
    const res = await cloudinary.uploader.upload(fileData, {
      folder: metadata.folder || 'aurelia-identity-docs',
      resource_type: isPdf ? 'raw' : 'image',
      type: 'authenticated'
    });

    return {
      url: res.url,
      secureUrl: res.secure_url,
      publicId: res.public_id,
      filename: metadata.filename,
      fileType: metadata.fileType,
      fileSize: metadata.fileSize
    };
  },

  /**
   * Generate signed parameters for secure direct client-side uploads.
   */
  generateUploadSignature(folder: string = 'aurelia-salons'): {
    timestamp: number;
    signature: string;
    apiKey: string;
    cloudName: string;
  } {
    if (!isConfigured) {
      throw new Error('Cloudinary credentials are not configured in environment variables.');
    }

    const timestamp = Math.round(new Date().getTime() / 1000);
    const signature = cloudinary.utils.api_sign_request(
      { timestamp, folder },
      env.CLOUDINARY_API_SECRET!
    );

    return {
      timestamp,
      signature,
      apiKey: env.CLOUDINARY_API_KEY!,
      cloudName: env.CLOUDINARY_CLOUD_NAME!
    };
  }
};
