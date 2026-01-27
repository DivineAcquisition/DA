'use client';

import { useEffect, useRef } from 'react';

interface WistiaPlayerProps {
  mediaId: string;
  aspect?: string;
}

export default function WistiaPlayer({ mediaId, aspect = '1.7777777777777777' }: WistiaPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      // Create the wistia-player element
      const player = document.createElement('wistia-player');
      player.setAttribute('media-id', mediaId);
      player.setAttribute('aspect', aspect);
      containerRef.current.innerHTML = '';
      containerRef.current.appendChild(player);
    }
  }, [mediaId, aspect]);

  return <div ref={containerRef} className="w-full" />;
}
