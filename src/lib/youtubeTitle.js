/** Cache des titres oEmbed (évite de re-fetch la même vidéo). */
const titleCache = new Map()

export function isYoutubeUrl(raw) {
  try {
    const host = new URL(raw).hostname.replace(/^www\./i, '').toLowerCase()
    return (
      host === 'youtube.com'
      || host === 'm.youtube.com'
      || host === 'music.youtube.com'
      || host === 'youtu.be'
    )
  } catch {
    return false
  }
}

/**
 * Titre de la vidéo via l’oEmbed YouTube (pas de clé API).
 * Renvoie null si ce n’est pas YouTube ou si la requête échoue.
 */
export async function fetchYoutubeTitle(raw) {
  const url = String(raw || '').trim()
  if (!url || !isYoutubeUrl(url)) return null
  if (titleCache.has(url)) return titleCache.get(url)

  const promise = fetch(
    `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
  )
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      const title = String(data?.title || '').trim()
      return title || null
    })
    .catch(() => null)

  titleCache.set(url, promise)
  return promise
}
