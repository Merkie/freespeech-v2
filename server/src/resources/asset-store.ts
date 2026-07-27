import { HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { MEDIA_HOST, templateAssetKey, templateAssetUrl } from '@/data/templates';
import s3 from '@/resources/s3';
import { R2_BUCKET } from '@/utils/env';
import type { AssetExt, AssetStore } from '@/utils/open-board-import';

// Every asset key is the SHA-256 of its bytes, so re-importing the same board twice writes
// nothing new and the objects can be cached forever.
const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable';

async function existsInR2(key: string): Promise<boolean> {
	try {
		await s3.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }));
		return true;
	} catch {
		return false;
	}
}

async function putToR2(key: string, body: Buffer, contentType: string) {
	await s3.send(
		new PutObjectCommand({
			Bucket: R2_BUCKET,
			Key: key,
			Body: body,
			ContentType: contentType,
			CacheControl: IMMUTABLE_CACHE,
		}),
	);
}

/** Shared prefix used by the starter templates, which every user's copy points at. */
export const templateAssetStore: AssetStore = {
	has: (hash, ext) => existsInR2(templateAssetKey(hash, ext)),
	put: (hash, ext, bytes, contentType) => putToR2(templateAssetKey(hash, ext), bytes, contentType),
	url: (hash, ext) => templateAssetUrl(hash, ext),
};

export function userImportAssetKey(userId: string, hash: string, ext: AssetExt): string {
	return `user-imports/${userId}/${hash}.${ext}`;
}

/**
 * A user's own imported boards. Deliberately scoped per user rather than sharing the template
 * prefix: an imported board can contain personal photographs, and one person deleting a project
 * should never be able to affect another person's tiles.
 */
export function userImportAssetStore(userId: string): AssetStore {
	return {
		has: (hash, ext) => existsInR2(userImportAssetKey(userId, hash, ext)),
		put: (hash, ext, bytes, contentType) => putToR2(userImportAssetKey(userId, hash, ext), bytes, contentType),
		url: (hash, ext) => `${MEDIA_HOST}/${userImportAssetKey(userId, hash, ext)}`,
	};
}
