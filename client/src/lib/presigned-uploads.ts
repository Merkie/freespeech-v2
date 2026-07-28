import api from './api';
import { compressImage, MAX_UPLOAD_BYTES } from './image-compress';

export async function uploadFile(file: File) {
	const compressed = await compressImage(file);

	if (compressed.blob.size > MAX_UPLOAD_BYTES) return undefined;

	const presignResponse = await api.media.presignUpload(compressed.filename, compressed.blob.size);

	const uploadResponse = await fetch(presignResponse.presignedUrl, {
		method: 'PUT',
		body: compressed.blob,
	});

	if (uploadResponse.status === 200) {
		return presignResponse.key;
	}

	return undefined;
}

export async function uploadBlob(filename: string, blob: Blob) {
	const file = new File([blob], filename, { type: blob.type });
	return uploadFile(file);
}
