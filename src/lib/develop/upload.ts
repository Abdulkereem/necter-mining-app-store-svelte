/**
 * Listing images go to the Hub asset store (`POST /v1/developers/assets`, PNG/JPEG/WebP ≤ 2 MiB), which returns the
 * https URL the manifest references (PLATFORM.md §a.3).
 */
import { hub } from '$lib/api/hub';

const TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
type ImageType = (typeof TYPES)[number];
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const IMAGE_ACCEPT = TYPES.join(',');

function isImageType(t: string): t is ImageType {
	return (TYPES as readonly string[]).includes(t);
}

export function fileToBase64(file: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const r = new FileReader();
		r.onload = () => {
			const s = String(r.result ?? '');
			resolve(s.slice(s.indexOf(',') + 1));
		};
		r.onerror = () => reject(r.error ?? new Error('Could not read the file'));
		r.readAsDataURL(file);
	});
}

/** Uploads an image and returns its asset URL. Throws a readable error for unsupported or oversized files. */
export async function uploadImage(file: File): Promise<string> {
	if (!isImageType(file.type)) throw new Error('Use a PNG, JPEG or WebP image');
	if (file.size > MAX_IMAGE_BYTES) throw new Error('Images must be 2 MB or smaller');
	const { url } = await hub.uploadAsset(file.type, await fileToBase64(file));
	return url;
}
