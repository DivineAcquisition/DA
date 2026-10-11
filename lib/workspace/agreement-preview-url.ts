/** A download name that cannot break the Content-Disposition header. */
export function agreementPdfFilename(name: string): string {
  const clean = name.replace(/[^\w.\- ]+/g, '').trim() || 'Agreement';
  return clean.toLowerCase().endsWith('.pdf') ? clean : `${clean}.pdf`;
}

/** DocuSeal hands back a file URL. Only https is fetched. */
export function previewDocumentUrl(url: string): string | null {
  try {
    return new URL(url).protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

function looseName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[™®]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** When a template has several files, use the one that is this agreement. */
export function choosePreviewDocument(
  docs: Array<{ name: string; url: string }>,
  templateName: string,
): { name: string; url: string } | null {
  const usable = docs.filter((doc) => previewDocumentUrl(doc.url));
  if (usable.length === 0) return null;
  const wanted = looseName(templateName);
  const match = usable.find((doc) => {
    const name = looseName(doc.name);
    return (
      (wanted && name === wanted) ||
      name.includes('sales operator placement') ||
      (wanted.includes('sales operator placement') && name.includes('placement'))
    );
  });
  return match ?? usable[0];
}
