'use client';

import { useMemo } from 'react';

interface LocationMapProps {
  latitude: number | string;
  longitude: number | string;
  height?: string;
  className?: string;
}

export function LocationMap({ latitude, longitude, height = '240px', className = '' }: LocationMapProps) {
  const googleKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const src = useMemo(() => {
    const lat = Number(latitude);
    const lon = Number(longitude);
    if (Number.isNaN(lat) || Number.isNaN(lon)) return '';
    if (googleKey) {
      return `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(googleKey)}&q=${lat},${lon}&zoom=15`;
    }
    const delta = 0.015;
    const bbox = `${lon - delta},${lat - delta},${lon + delta},${lat + delta}`;
    return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${lat},${lon}`;
  }, [latitude, longitude, googleKey]);

  if (!src) {
    return (
      <div className={`nm-raised flex items-center justify-center text-sm text-muted-foreground ${className}`} style={{ height }}>
        No location data
      </div>
    );
  }

  return (
    <iframe
      width="100%"
      height={height}
      style={{ border: 0 }}
      loading="lazy"
      allowFullScreen
      src={src}
      className={`nm-raised overflow-hidden ${className}`}
      title="Location map"
    />
  );
}
