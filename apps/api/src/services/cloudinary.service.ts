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
  console.info('[Cloudinary] SDK initialized successfully with cloud name:', env.CLOUDINARY_CLOUD_NAME);
} else {
  console.info('[Cloudinary] Cloudinary environment variables not fully configured; operating in local/mock mode.');
}

export interface CloudinaryImageUploadResult {
  url: string;
  secureUrl: string;
  publicId: string;
  width?: number;
  height?: number;
  format?: string;
  resourceType: 'image';
}

export interface CloudinaryDocumentUploadResult {
  url: string;
  secureUrl: string;
  publicId: string;
  filename: string;
  fileType: string;
  fileSize?: number;
  resourceType: 'image' | 'raw';
}

export const cloudinaryService = {
  isAvailable(): boolean {
    return isConfigured;
  },

  /**
   * Extract public ID from a Cloudinary URL or return the string if it is already a public ID.
   */
  extractPublicId(urlOrId: string): string | null {
    if (!urlOrId || typeof urlOrId !== 'string') return null;
    const trimmed = urlOrId.trim();
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      return trimmed;
    }

    const isRaw = trimmed.includes('/raw/');
    if (isRaw) {
      const match = trimmed.match(/\/raw\/(?:upload|authenticated|private)\/(?:s--[A-Za-z0-9_-]+--\/)?(?:v\d+\/)?([^\?\#]+)/);
      return match ? match[1] : null;
    }

    const match = trimmed.match(/\/(?:image|video)\/(?:upload|authenticated|private)\/(?:s--[A-Za-z0-9_-]+--\/)?(?:v\d+\/)?([^\.\?\#]+)/);
    return match ? match[1] : null;
  },

  /**
   * Upload an image (salon gallery, offer banner, profile avatar).
   * Supports JPEG, PNG, WebP format validation and up to 5MB file sizes.
   */
  async uploadImage(
    fileData: string,
    options: { folder?: string; publicId?: string; maxWidth?: number; maxHeight?: number } = {}
  ): Promise<CloudinaryImageUploadResult> {
    if (!fileData || typeof fileData !== 'string' || !fileData.trim()) {
      throw new Error('Image data is required for upload.');
    }

    // Validate size (max 5MB binary, roughly 7.2MB in base64 data URI)
    if (fileData.length > 7.5 * 1024 * 1024) {
      throw new Error('Image file size exceeds the 5MB limit.');
    }

    // Validate data URI format and MIME type if provided
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
      // return the actual uploaded image data with a generated identifier
      const mockId = `${options.folder || 'aurelia-salons'}/img_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      return {
        url: fileData,
        secureUrl: fileData,
        publicId: mockId,
        resourceType: 'image'
      };
    }

    const res = await cloudinary.uploader.upload(fileData, {
      folder: options.folder || 'aurelia-salons',
      public_id: options.publicId,
      resource_type: 'image',
      transformation: [
        { width: options.maxWidth || 1200, height: options.maxHeight || 800, crop: 'limit' },
        { quality: 'auto', fetch_format: 'auto' }
      ]
    });

    return {
      url: res.url,
      secureUrl: res.secure_url,
      publicId: res.public_id,
      width: res.width,
      height: res.height,
      format: res.format,
      resourceType: 'image'
    };
  },

  /**
   * Upload an identity proof document with format & size verification.
   * Stores with type: 'authenticated' so the file cannot be accessed publicly without a signed signature.
   */
  async uploadDocument(
    fileData: string,
    metadata: { filename: string; fileType: string; fileSize?: number; folder?: string }
  ): Promise<CloudinaryDocumentUploadResult> {
    const allowedMime = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'application/pdf'];
    const allowedExts = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];
    const ext = metadata.filename.toLowerCase().slice(metadata.filename.lastIndexOf('.'));
    const isMimeOk = allowedMime.includes(metadata.fileType.toLowerCase());
    const isExtOk = allowedExts.includes(ext);

    if (!isMimeOk && !isExtOk) {
      throw new Error('Unsupported document format. Allowed formats: JPG, PNG, WebP, PDF');
    }

    if (metadata.fileSize && metadata.fileSize > 10 * 1024 * 1024) {
      throw new Error('Document file size exceeds 10MB limit');
    }

    const isPdf = metadata.fileType.includes('pdf') || ext === '.pdf';
    const folder = metadata.folder || 'aurelia-identity-docs';
    const docId = `${folder}/doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}${isPdf ? '.pdf' : ''}`;

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
        fileSize: metadata.fileSize,
        resourceType: isPdf ? 'raw' : 'image'
      };
    }

    const res = await cloudinary.uploader.upload(fileData, {
      folder,
      resource_type: isPdf ? 'raw' : 'image',
      type: 'authenticated'
    });

    return {
      url: res.url,
      secureUrl: res.secure_url,
      publicId: res.public_id,
      filename: metadata.filename,
      fileType: metadata.fileType,
      fileSize: metadata.fileSize,
      resourceType: isPdf ? 'raw' : 'image'
    };
  },

  createIdentityDocumentUploadSignature(metadata: {
    filename: string;
    fileType: string;
    fileSize: number;
  }): {
    timestamp: number;
    signature: string;
    apiKey: string;
    cloudName: string;
    folder: string;
    publicId: string;
    resourceType: 'image' | 'raw';
    deliveryType: 'authenticated';
  } {
    this.validateIdentityDocumentMetadata(metadata);
    if (!isConfigured) {
      throw new Error('Cloudinary document storage is not configured.');
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const folder = 'aurelia-identity-docs';
    const isPdf = metadata.fileType.toLowerCase() === 'application/pdf';
    const publicId = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 12)}${isPdf ? '.pdf' : ''}`;
    const resourceType = isPdf ? 'raw' : 'image';
    const deliveryType = 'authenticated' as const;
    const signature = cloudinary.utils.api_sign_request(
      { folder, public_id: publicId, timestamp, type: deliveryType },
      env.CLOUDINARY_API_SECRET!
    );

    return {
      timestamp,
      signature,
      apiKey: env.CLOUDINARY_API_KEY!,
      cloudName: env.CLOUDINARY_CLOUD_NAME!,
      folder,
      publicId,
      resourceType,
      deliveryType
    };
  },

  async confirmIdentityDocumentUpload(
    publicId: string,
    metadata: { filename: string; fileType: string; fileSize: number }
  ): Promise<CloudinaryDocumentUploadResult> {
    this.validateIdentityDocumentMetadata(metadata);
    if (!isConfigured) {
      throw new Error('Cloudinary document storage is not configured.');
    }
    const isPdf = metadata.fileType.toLowerCase() === 'application/pdf';
    const validPublicId = isPdf
      ? /^(?:aurelia-identity-docs\/)?doc_[a-zA-Z0-9_-]+\.pdf$/.test(publicId)
      : /^(?:aurelia-identity-docs\/)?doc_[a-zA-Z0-9_-]+$/.test(publicId);
    if (!validPublicId) {
      throw new Error('Invalid uploaded document identifier.');
    }

    const resourceType = isPdf ? 'raw' : 'image';
    const resource = await cloudinary.api.resource(publicId, {
      resource_type: resourceType,
      type: 'authenticated'
    });
    const actualSize = Number(resource.bytes);
    if (!resource.secure_url || resource.public_id !== publicId || !Number.isFinite(actualSize)) {
      throw new Error('Cloudinary did not confirm the uploaded document.');
    }
    if (actualSize <= 0 || actualSize > 10 * 1024 * 1024) {
      throw new Error('Uploaded document file size is invalid or exceeds the 10MB limit.');
    }
    if (metadata.fileSize !== actualSize) {
      throw new Error('Uploaded document size does not match the selected file.');
    }

    return {
      url: resource.secure_url,
      secureUrl: resource.secure_url,
      publicId: resource.public_id,
      filename: metadata.filename,
      fileType: metadata.fileType,
      fileSize: actualSize,
      resourceType
    };
  },

  validateIdentityDocumentMetadata(metadata: {
    filename: string;
    fileType: string;
    fileSize: number;
  }): void {
    const extension = metadata.filename.toLowerCase().slice(metadata.filename.lastIndexOf('.'));
    const allowedTypes: Record<string, string[]> = {
      '.jpg': ['image/jpeg', 'image/jpg'],
      '.jpeg': ['image/jpeg', 'image/jpg'],
      '.png': ['image/png'],
      '.pdf': ['application/pdf']
    };
    const matchingTypes = allowedTypes[extension];
    if (!metadata.filename.trim() || !matchingTypes?.includes(metadata.fileType.toLowerCase())) {
      throw new Error('Unsupported document format. Allowed formats: JPG, PNG, PDF');
    }
    if (!Number.isInteger(metadata.fileSize) || metadata.fileSize <= 0) {
      throw new Error('Document file size must be greater than zero.');
    }
    if (metadata.fileSize > 10 * 1024 * 1024) {
      throw new Error('Document file size exceeds 10MB limit');
    }
  },

  /**
   * Generate a secure, time-limited signed URL for viewing private/authenticated identity documents.
   * Default expiration: 1 hour (3600 seconds).
   */
  generatePrivateDocumentUrl(
    publicIdOrUrl: string,
    options: { resourceType?: 'image' | 'raw'; expiresInSeconds?: number } = {}
  ): string {
    const publicId = this.extractPublicId(publicIdOrUrl) || publicIdOrUrl;
    if (!isConfigured) {
      return publicIdOrUrl;
    }

    const isPdf = publicId.toLowerCase().endsWith('.pdf') || (options.resourceType === 'raw');
    const resourceType = options.resourceType || (isPdf ? 'raw' : 'image');
    const expiresInSeconds = options.expiresInSeconds || 3600;
    const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;

    return cloudinary.url(publicId, {
      resource_type: resourceType,
      type: 'authenticated',
      sign_url: true,
      secure: true,
      expires_at: expiresAt
    });
  },

  /**
   * Safely delete a Cloudinary asset by publicId or URL.
   * If requiredPrefix is provided, verifies that the asset belongs to the expected user/salon before deletion.
   */
  async deleteAsset(
    publicIdOrUrl: string,
    options: {
      resourceType?: 'image' | 'raw';
      type?: 'upload' | 'authenticated';
      requiredPrefix?: string;
    } = {}
  ): Promise<boolean> {
    try {
      const publicId = this.extractPublicId(publicIdOrUrl);
      if (!publicId) return false;

      // Ownership verification: ensure asset public ID matches user/salon prefix
      if (options.requiredPrefix && !publicId.startsWith(options.requiredPrefix)) {
        console.warn(`[Cloudinary] Asset deletion blocked: publicId "${publicId}" does not match required ownership prefix "${options.requiredPrefix}".`);
        return false;
      }

      if (!isConfigured) {
        console.info(`[Cloudinary Mock] Asset deleted: ${publicId}`);
        return true;
      }

      const res = await cloudinary.uploader.destroy(publicId, {
        resource_type: options.resourceType || 'image',
        type: options.type || 'upload'
      });

      return res.result === 'ok' || res.result === 'not found';
    } catch (err: any) {
      console.warn('[Cloudinary] Failed to delete asset safely:', err?.message || err);
      return false;
    }
  },

  /**
   * Generate signed parameters for secure direct client-side uploads.
   * Allows mobile client to upload directly to Cloudinary, bypassing Vercel 4.5MB request limit.
   */
  generateUploadSignature(folder: string = 'aurelia-salons'): {
    timestamp: number;
    signature: string;
    apiKey: string;
    cloudName: string;
    folder: string;
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
      cloudName: env.CLOUDINARY_CLOUD_NAME!,
      folder
    };
  }
};
