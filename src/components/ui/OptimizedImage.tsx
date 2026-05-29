import Image, { type ImageProps } from 'next/image'
import type { ImgHTMLAttributes } from 'react'

type NativeImageProps = Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  'alt' | 'height' | 'placeholder' | 'src' | 'srcSet' | 'width'
>

interface OptimizedImageProps extends NativeImageProps {
  src?: string | null
  alt: string
  width?: number | `${number}`
  height?: number | `${number}`
  fill?: boolean
  priority?: boolean
  sizes?: string
  unoptimized?: boolean
}

function toNumber(value: number | `${number}` | undefined, fallback: number) {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

export function OptimizedImage({
  src,
  alt,
  width,
  height,
  fill,
  priority,
  sizes,
  unoptimized = true,
  ...props
}: OptimizedImageProps) {
  if (!src) return null

  const imageProps: Omit<ImageProps, 'alt' | 'src'> = fill
    ? { fill: true, sizes, priority, unoptimized }
    : {
        width: toNumber(width, 96),
        height: toNumber(height, 96),
        sizes,
        priority,
        unoptimized,
      }

  return <Image src={src} alt={alt} {...imageProps} {...props} />
}
