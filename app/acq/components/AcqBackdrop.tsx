/**
 * Quieter product backdrop for the acq landing — a faint grid and one brand
 * wash. No floating orbs. The page should read like a SaaS surface, not a
 * glow marketing site.
 */
export default function AcqBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.7) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.7) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          maskImage: 'radial-gradient(ellipse 80% 50% at 50% 0%, #000 20%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 50% at 50% 0%, #000 20%, transparent 75%)',
        }}
      />
      <div
        className="absolute -top-[28%] left-1/2 h-[640px] w-[1100px] -translate-x-1/2"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(154,136,252,0.18) 0%, rgba(102,80,216,0.08) 42%, transparent 70%)',
          filter: 'blur(80px)',
        }}
      />
    </div>
  );
}
