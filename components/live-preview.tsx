"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "cn";

/**
 * A component's live render in a sandboxed iframe. The render is third-party code, so the
 * frame gets scripts but never same-origin access. It mounts only near the viewport and
 * unmounts when scrolled far away, so a grid of dozens stays light; the poster screenshot
 * shows underneath until the component reports it has rendered.
 *
 * `canvas` (blocks): lay the render out at that width, like a desktop page, and scale the
 * whole frame down to the card. Without it the render gets the card's own size.
 * `full` (quick view): long renders may scroll inside the frame.
 */
export function LivePreview({
  src,
  poster,
  title,
  className,
  eager = false,
  canvas,
  full = false,
}: {
  src: string;
  poster?: string | null;
  title: string;
  className?: string;
  eager?: boolean;
  canvas?: number;
  full?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [near, setNear] = useState(eager);
  const [loaded, setLoaded] = useState(false);
  const [box, setBox] = useState<{ width: number; height: number } | null>(null);

  // Hide the poster only once the component itself reports a good render. A frame's `load`
  // also fires for a blocked frame, a failed import, or a crash, which would leave a white
  // box where the screenshot was.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow) return;
      const data = event.data as { source?: string; ok?: boolean } | null;
      if (data?.source === "component-render" && data.ok) setLoaded(true);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

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

  useEffect(() => {
    const el = ref.current;
    if (!el || !canvas) return;
    const observer = new ResizeObserver(([entry]) =>
      setBox({ width: entry.contentRect.width, height: entry.contentRect.height }),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [canvas]);

  const scale = canvas && box ? box.width / canvas : 1;
  const frameStyle =
    canvas && box
      ? {
          width: canvas,
          height: box.height / scale,
          transform: `scale(${scale})`,
          transformOrigin: "0 0",
        }
      : undefined;
  const ready = near && (!canvas || box);

  return (
    <div ref={ref} className={cn("relative overflow-hidden bg-white", className)}>
      {poster ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={poster}
          alt=""
          aria-hidden
          className={cn(
            "absolute inset-0 size-full object-cover object-top transition-opacity duration-300",
            loaded && "opacity-0",
          )}
        />
      ) : null}
      {ready ? (
        <iframe
          ref={frame}
          src={full ? `${src}?mode=full` : src}
          title={`${title} live preview`}
          sandbox="allow-scripts allow-pointer-lock allow-forms"
          loading="lazy"
          referrerPolicy="no-referrer"
          style={frameStyle}
          className={cn("absolute top-0 left-0 border-0", !frameStyle && "size-full")}
        />
      ) : null}
      <div className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-black/5 dark:ring-white/5" />
    </div>
  );
}
