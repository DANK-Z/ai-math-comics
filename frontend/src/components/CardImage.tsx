// Card pictures (chapter and season covers) come with a 480 px copy next to the full art
// (`name.thumb.webp`, made from the 960 px original). With `srcset` the browser takes the small
// one for a card on a normal screen and the full one where it is needed (a phone's dense
// screen, a big hero) — about 3× fewer bytes for lists on a slow connection.

const FULL = import.meta.glob<string>(['../assets/**/*.webp', '!../assets/**/*.thumb.webp'], { eager: true, import: 'default' })
const THUMBS = import.meta.glob<string>('../assets/**/*.thumb.webp', { eager: true, import: 'default' })

const SMALL = new Map<string, string>()
for (const [path, url] of Object.entries(FULL)) {
  const thumb = THUMBS[path.replace(/\.webp$/, '.thumb.webp')]
  if (thumb) SMALL.set(url, thumb)
}

/** The 480 px copy of a bundled picture, if there is one. */
export const thumbOf = (url: string) => SMALL.get(url)

export function CardImage({ src, sizes, className, loading = 'lazy' }: { src: string; sizes: string; className?: string; loading?: 'lazy' | 'eager' }) {
  const small = thumbOf(src)
  return (
    <img src={small ?? src} srcSet={small ? `${small} 480w, ${src} 960w` : undefined} sizes={small ? sizes : undefined}
      alt="" loading={loading} decoding="async" className={className} />
  )
}
