import { useEffect, useRef } from "react";

interface MediaTileProps {
  title: string;
  stream: MediaStream;
}

export function MediaTile({ title, stream }: MediaTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.srcObject = stream;
  }, [stream]);

  return (
    <div className="media-tile">
      <video ref={videoRef} autoPlay muted playsInline />
      <span>{title}</span>
    </div>
  );
}

