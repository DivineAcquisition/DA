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
