import { ObjectStorageService } from "./objectStorage";

type StorageCleanupLogger = {
  warn: (details: unknown, message: string) => void;
};

const objectStorageService = new ObjectStorageService();

async function deleteWithRetry(objectPath: string): Promise<void> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await objectStorageService.tryDeleteObjectEntity(objectPath);
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 100));
    }
  }
  throw lastError;
}

export async function deleteSubmissionImageObjects(
  objectPaths: string[],
  log: StorageCleanupLogger,
): Promise<void> {
  const uniquePaths = Array.from(new Set(objectPaths.filter(Boolean)));
  const results = await Promise.allSettled(uniquePaths.map(deleteWithRetry));
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      log.warn(
        { err: result.reason, objectPath: uniquePaths[index] },
        "Submission image object cleanup failed after retries",
      );
    }
  });
}