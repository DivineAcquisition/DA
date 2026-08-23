/**
 * Quiet product backdrop — a faint grid and one brand wash.
 * Reads like a SaaS surface, not a glow marketing site.
 */
export default function AcqBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.7) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.7) 1px, transparent 1px)',
          backgroundSize: '72px 72px',
          maskImage: 'radial-gradient(ellipse 70% 42% at 50% 0%, #000 18%, transparent 72%)',
          WebkitMaskImage: 'radial-gradient(ellipse 70% 42% at 50% 0%, #000 18%, transparent 72%)',
        }}
      />
      <div
        className="absolute -top-[30%] left-1/2 h-[620px] w-[980px] -translate-x-1/2"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(154,136,252,0.16) 0%, rgba(102,80,216,0.06) 46%, transparent 72%)',
          filter: 'blur(72px)',
        }}
      />
    </div>
  );
}
