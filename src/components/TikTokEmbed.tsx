'use client';

import React, { useEffect } from 'react';

interface TikTokEmbedProps {
  embedHtml: string;
}

export default function TikTokEmbed({ embedHtml }: TikTokEmbedProps) {
  useEffect(() => {
    if (!embedHtml) return;

    // Clean up any previously attached embed.js script so TikTok re-scans the DOM
    const SCRIPT_URL = 'https://www.tiktok.com/embed.js';
    const oldScript = document.querySelector(`script[src="${SCRIPT_URL}"]`);
    if (oldScript) {
      oldScript.remove();
    }

    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    document.body.appendChild(script);

    return () => {
      // Optional: keep script or cleanup
    };
  }, [embedHtml]);

  if (!embedHtml) return null;

  // Strip inert <script> tags from the raw embed HTML string if present
  const cleanHtml = embedHtml.replace(/<script[\s\S]*?<\/script>/gi, '').trim();

  return (
    <div
      className="tiktok-container"
      dangerouslySetInnerHTML={{ __html: cleanHtml }}
    />
  );
}
