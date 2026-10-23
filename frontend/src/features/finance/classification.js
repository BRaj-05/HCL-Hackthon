// Presentation helpers for the backend's account classification.
// The demo engine uses these same thresholds; live balances come from the API.
export const OVERDUE_BUCKETS = ['Current', '1–30', '31–60', '61–90', '90+'];
export function classifyDpd(days) {
  if (!Number.isFinite(days) || days < 0) throw new Error('DPD must be a non-negative number.');
  return days === 0 ? 'Current' : days <= 30 ? '1–30' : days <= 60 ? '31–60' : days <= 90 ? '61–90' : '90+';
}
export function classifyPriority(days) { return days > 60 ? 'High' : days > 15 ? 'Medium' : 'Low'; }
export function collectionStrategy(days) { return days > 90 ? 'Head review' : days > 60 ? 'Manager escalation' : days > 30 ? 'Collector follow-up' : days > 0 ? 'Payment reminder' : 'Monitor'; }
