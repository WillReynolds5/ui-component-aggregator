"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "cn";

/**
 * A component's live render in a sandboxed iframe. The render is third-party code, so the
 * frame gets scripts but never same-origin access. It mounts only near the viewport and
 * unmounts when scrolled far away, so a grid of dozens stays light; the poster screenshot
 * shows underneath until the frame has painted.
 */
export function LivePreview({
  src,
  poster,
  title,
  className,
  eager = false,
}: {
  src: string;
  poster?: string | null;
  title: string;
  className?: string;
  eager?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(eager);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || eager) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setNear(entry.isIntersecting);
        if (!entry.isIntersecting) setLoaded(false);
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [eager]);

  return (
    <div ref={ref} className={cn("relative overflow-hidden bg-white", className)}>
      {poster ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={poster}
          alt=""
          aria-hidden
          className={cn(
            "absolute inset-0 size-full object-cover transition-opacity duration-300",
            loaded && "opacity-0",
          )}
        />
      ) : null}
      {near ? (
        <iframe
          src={src}
          title={`${title} live preview`}
          sandbox="allow-scripts allow-pointer-lock allow-forms"
          loading="lazy"
          referrerPolicy="no-referrer"
          onLoad={() => setLoaded(true)}
          className="absolute inset-0 size-full border-0"
        />
      ) : null}
      <div className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-black/5 dark:ring-white/5" />
    </div>
  );
}
