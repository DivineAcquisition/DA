/**
 * The careers postings that hire a Sales Operator. Both submit to
 * submit_role_application, so their rows are the Applicants inbox. There is
 * no second application queue.
 */
export const SALES_OPERATOR_ROLE_SLUGS = ['setter', 'sdr-placement'] as const;

export function isSalesOperatorRole(slug: string): boolean {
  return (SALES_OPERATOR_ROLE_SLUGS as readonly string[]).includes(slug);
}
