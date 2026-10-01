import * as tus from 'tus-js-client';

export interface BunnySignedUploadCredentials {
  video_id: string;
  library_id: string | number;
  signature: string;
  expiration_time: number;
  title?: string;
}

export interface BunnyUploadDiagnostic {
  sessionId: string;
  videoId: string;
  fileName: string;
  fileSize: number;
  message: string;
  status?: number;
  offset?: number;
}

export interface BunnyUploadCallbacks {
  onProgress?: (bytesSent: number, bytesTotal: number, percent: number) => void;
  onSuccess?: () => void;
  onError?: (error: Error, diagnostic: BunnyUploadDiagnostic) => void;
}

export interface BunnyUploadHandle {
  sessionId: string;
  videoId: string;
  abort: () => void;
  tusInstance: tus.Upload;
}

/**
 * Resilient direct-to-Bunny TUS upload helper.
 * - Enforces 5MB chunking for robust resume on Bunny Stream.
 * - Reuses existing upload offsets via findPreviousUploads() instead of restarting from 0.
 * - Safely logs diagnostics without exposing tokens or secrets.
 * - Operates directly from browser to Bunny Stream (never passes video bytes through Vercel/Laravel).
 */
export function startBunnyTusUpload(
  file: File,
  credentials: BunnySignedUploadCredentials,
  callbacks: BunnyUploadCallbacks = {}
): BunnyUploadHandle {
  const sessionId =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `upload_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  let isAborted = false;

  console.log('[BUNNY_TUS] UPLOAD_CREATED', {
    sessionId,
    videoId: credentials.video_id,
    fileName: file.name,
    fileSize: file.size,
    chunkSize: 5 * 1024 * 1024,
  });

  const upload = new tus.Upload(file, {
    endpoint: 'https://video.bunnycdn.com/tusupload',
    retryDelays: [0, 3000, 5000, 10000, 20000],
    chunkSize: 5 * 1024 * 1024, // 5MB chunk size required by Bunny Stream
    headers: {
      AuthorizationSignature: credentials.signature,
      AuthorizationExpire: String(credentials.expiration_time),
      LibraryId: String(credentials.library_id),
      VideoId: credentials.video_id,
    },
    fingerprint: (_file: any, _options: any) => {
      return Promise.resolve(`tus-bunny-${credentials.library_id}-${credentials.video_id}`);
    },
    metadata: {
      filetype: file.type || 'video/mp4',
      title: credentials.title || file.name,
    },
    onError: (error: any) => {
      if (isAborted) {
        console.log('[BUNNY_TUS] UPLOAD_ABORTED_CONFIRMED', {
          sessionId,
          videoId: credentials.video_id,
        });
        return;
      }

      // Redact signature if present in error message
      const rawMessage = error?.message || 'فشل رفع الفيديو إلى خوادم Bunny Stream.';
      const safeMessage = credentials.signature
        ? rawMessage.replace(credentials.signature, '[REDACTED]')
        : rawMessage;

      const diagnostic: BunnyUploadDiagnostic = {
        sessionId,
        videoId: credentials.video_id,
        fileName: file.name,
        fileSize: file.size,
        message: safeMessage,
        status: error?.originalResponse?.getStatus ? error.originalResponse.getStatus() : undefined,
      };

      console.error('[BUNNY_TUS] UPLOAD_ERROR', diagnostic);
      callbacks.onError?.(new Error(safeMessage), diagnostic);
    },
    onProgress: (bytesSent: number, bytesTotal: number) => {
      if (isAborted) return;
      const percent = Math.min(100, Math.round((bytesSent / bytesTotal) * 100));
      console.log('[BUNNY_TUS] UPLOAD_PROGRESS', {
        sessionId,
        videoId: credentials.video_id,
        bytesSent,
        bytesTotal,
        percent,
      });
      callbacks.onProgress?.(bytesSent, bytesTotal, percent);
    },
    onSuccess: () => {
      if (isAborted) return;
      console.log('[BUNNY_TUS] UPLOAD_COMPLETED', {
        sessionId,
        videoId: credentials.video_id,
        totalBytes: file.size,
      });
      callbacks.onSuccess?.();
    },
  });

  // Query previous uploads for resumable upload check
  upload
    .findPreviousUploads()
    .then((previousUploads) => {
      if (isAborted) return;
      if (previousUploads && previousUploads.length > 0) {
        console.log('[BUNNY_TUS] UPLOAD_RESUMING', {
          sessionId,
          videoId: credentials.video_id,
          previousCount: previousUploads.length,
        });
        upload.resumeFromPreviousUpload(previousUploads[0]);
      } else {
        console.log('[BUNNY_TUS] UPLOAD_STARTED', {
          sessionId,
          videoId: credentials.video_id,
        });
      }
      upload.start();
    })
    .catch((err) => {
      if (isAborted) return;
      console.warn('[BUNNY_TUS] findPreviousUploads warning, starting normal upload:', err);
      console.log('[BUNNY_TUS] UPLOAD_STARTED', {
        sessionId,
        videoId: credentials.video_id,
      });
      upload.start();
    });

  return {
    sessionId,
    videoId: credentials.video_id,
    abort: () => {
      isAborted = true;
      console.log('[BUNNY_TUS] UPLOAD_ABORTED', {
        sessionId,
        videoId: credentials.video_id,
      });
      try {
        upload.abort();
      } catch (e) {
        console.warn('Error during TUS abort:', e);
      }
    },
    tusInstance: upload,
  };
}
