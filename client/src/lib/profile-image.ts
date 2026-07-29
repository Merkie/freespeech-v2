/**
 * Resolves a stored `User.profileImgUrl` to something an <img> can load.
 *
 * Two shapes are stored. Google sign-in saves the absolute `profile.picture` URL, which is
 * fetched through the API's image proxy because that host does not send CORS headers. An
 * uploaded picture is stored as an R2 object path and is served straight off the media host.
 *
 * The join is slash-tolerant on purpose: the presign endpoint returns a bare key while
 * `Project.imageUrl` is stored with a leading slash, and concatenating the two forms against a
 * base URL that has no trailing slash is what produced `media.freespeechaac.comdella-…` — a
 * hostname that does not resolve, so the picture loaded as a broken image.
 */
export function resolveProfileImageUrl(profileImgUrl: string | null | undefined): string {
	if (!profileImgUrl) return '';

	if (profileImgUrl.startsWith('http')) {
		return `${import.meta.env.VITE_API_URL}/image-proxy?url=${encodeURIComponent(profileImgUrl)}`;
	}

	return `${import.meta.env.VITE_R2_URL.replace(/\/+$/, '')}/${profileImgUrl.replace(/^\/+/, '')}`;
}
