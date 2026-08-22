export function SiteBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-metalBase">
      {/* Base metallic gradient — dark gunmetal tones rather than flat black. */}
      <div
        className="absolute inset-0"
        style={{ backgroundImage: 'linear-gradient(160deg, #17181c 0%, #0d0e10 45%, #131418 70%, #0a0a0c 100%)' }}
      />

      {/* Animated grid lines, slowly panning for a subtle sense of motion. */}
      <div className="absolute inset-0 animate-grid-pan bg-grid bg-[length:46px_46px] opacity-100" />

      {/* Metallic sheen — a soft diagonal highlight band that sweeps across
          the page on a slow loop, mimicking light moving across brushed
          dark metal. */}
      <div
        className="absolute inset-0 animate-sheen-sweep bg-[length:220%_220%] opacity-[0.35]"
        style={{
          backgroundImage: 'linear-gradient(115deg, transparent 38%, rgba(255,255,255,0.22) 50%, transparent 62%)',
        }}
      />

      {/* Grain texture keeps the gradient from reading as flat/synthetic. */}
      <svg className="absolute inset-0 h-full w-full opacity-[0.05] mix-blend-overlay">
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>

      {/* Soft vignette for depth at the edges. */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.35)_100%)]" />
    </div>
  );
}
