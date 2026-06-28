interface StatusBadgeProps {
  status: string;
  flagged?: boolean;
}

export default function StatusBadge({ status, flagged }: StatusBadgeProps) {
  if (flagged && status === 'COMPLETED') {
    return <span className="badge badge-flagged">Flagged</span>;
  }

  const classMap: Record<string, string> = {
    PENDING: 'badge-pending',
    PROCESSING: 'badge-processing',
    COMPLETED: 'badge-completed',
    FAILED: 'badge-failed',
  };

  const labelMap: Record<string, string> = {
    PENDING: 'Pending',
    PROCESSING: 'Processing',
    COMPLETED: 'Completed',
    FAILED: 'Failed',
  };

  return (
    <span className={`badge ${classMap[status] ?? 'badge-pending'}`}>
      {labelMap[status] ?? status}
    </span>
  );
}
