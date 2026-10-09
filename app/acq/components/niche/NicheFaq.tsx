'use client';

export function NicheFaq({ items }: { items: { question: string; answer: string }[] }) {
  return (
    <div className="lx-faq">
      {items.map((item) => (
        <details
          key={item.question}
          onToggle={(event) => {
            const current = event.currentTarget;
            if (!current.open) return;
            // Closing siblings in the same toggle event is ignored by the browser.
            queueMicrotask(() => {
              current.parentElement?.querySelectorAll('details').forEach((other) => {
                if (other !== current) other.open = false;
              });
            });
          }}
        >
          <summary>
            <span>{item.question}</span>
            <span className="lx-plus" aria-hidden />
          </summary>
          <p className="lx-answer">{item.answer}</p>
        </details>
      ))}
    </div>
  );
}
