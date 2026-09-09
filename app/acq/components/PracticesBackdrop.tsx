/**
 * Practices landing background: black field, fading grid, purple glow at the top.
 * No particles and no side orbs.
 */
export default function PracticesBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-ink-950">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(rgba(154,136,252,0.22) 1px, transparent 1px), linear-gradient(90deg, rgba(154,136,252,0.22) 1px, transparent 1px)',
          backgroundSize: '72px 72px',
          maskImage: 'radial-gradient(ellipse 92% 58% at 50% 0%, #000 18%, transparent 74%)',
          WebkitMaskImage: 'radial-gradient(ellipse 92% 58% at 50% 0%, #000 18%, transparent 74%)',
        }}
      />

      <div
        className="absolute -top-[42%] left-1/2 h-[780px] w-[1400px] -translate-x-1/2"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(154,136,252,0.38) 0%, rgba(102,80,216,0.16) 42%, transparent 72%)',
          filter: 'blur(90px)',
        }}
      />

      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-500/45 to-transparent" />
    </div>
  );
}
