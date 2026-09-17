import React from 'react';
import { IconImage } from './Icons';

/**
 * Reserved space for an image that doesn't exist yet.
 *
 * Every image on this page goes through here, so swapping a placeholder for
 * the real asset is a one-prop change and nothing about the layout moves:
 *
 *   <ImageSlot label="Hero visual" ratio="3 / 4" />                 → placeholder
 *   <ImageSlot src={heroImg} alt="…" ratio="3 / 4" />               → the image
 *
 * Props:
 *   src     — once set, the slot renders the image instead of the placeholder
 *   ratio   — CSS aspect-ratio string; pass null when the parent sets the size
 *   radius  — corner radius in px, or a CSS string for per-corner values
 *   cover   — fill the box and crop (object-fit: cover), which is what you
 *             want for photos; false letterboxes instead (contain)
 */
export default function ImageSlot({
  src,
  alt = '',
  label = 'Image',
  ratio = '4 / 3',
  radius = 16,
  cover = true,
  className = '',
  style,
  ...rest
}) {
  const box = {
    ...(ratio ? { aspectRatio: ratio } : null),
    borderRadius: typeof radius === 'number' ? `${radius}px` : radius,
    ...style,
  };

  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        className={`lp-img-slot lp-img-slot--filled ${className}`}
        style={{ ...box, objectFit: cover ? 'cover' : 'contain' }}
        {...rest}
      />
    );
  }

  return (
    <div className={`lp-img-slot ${className}`} style={box} {...rest}>
      <span className="lp-img-slot__inner">
        <IconImage size={24} />
        <span>{label}</span>
      </span>
    </div>
  );
}
