import { AlertTriangle } from 'lucide-react';
import type { CapacityStatus } from '@servisapp/shared';
import { Badge } from '@/components/ui/badge';
import { t } from '@/i18n';

/**
 * FR-CMP-090 — *"the system shall **warn** the Admin when the number of Students
 * assigned to a Route Template exceeds the Vehicle's capacity"*.
 *
 * A warning, not a block, and the console must not turn it into one. Moving a child
 * between two full vehicles requires passing through an over-capacity state; blocking it
 * would force an Admin doing an ordinary September reshuffle to leave children unrouted
 * in between. The hard refusal belongs to trip generation (FR-RTE-070, Phase 5), where
 * the van has actual seats in it.
 */
export function CapacityBadge({ capacity }: { capacity: CapacityStatus }) {
  const label = t('capacity.value', {
    assigned: capacity.assigned,
    capacity: capacity.capacity,
  });

  if (!capacity.overCapacity) {
    return <Badge variant="secondary">{label}</Badge>;
  }

  return (
    <Badge variant="destructive" className="gap-1" title={t('capacity.overBody', { overBy: capacity.overBy })}>
      <AlertTriangle aria-hidden className="h-3 w-3" />
      {label}
    </Badge>
  );
}
