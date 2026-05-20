import { RespondingStaffLinks } from './RespondingStaffLinks';

interface EscalatedSupervisorNoticeProps {
  supervisorId: string;
  onStaffClick: (staffId: string) => void;
  variant: 'message' | 'banner';
}

export function EscalatedSupervisorNotice({
  supervisorId,
  onStaffClick,
  variant,
}: EscalatedSupervisorNoticeProps) {
  if (variant === 'banner') {
    return <span>ESCALATED - SUPERVISOR NOTIFIED</span>;
  }

  return (
    <span>
      ESCALATED: Emergency call unanswered.{' '}
      <RespondingStaffLinks
        staffIds={[supervisorId]}
        onStaffClick={onStaffClick}
        linkVariant="default"
        className="text-red-900"
      />{' '}
      notified.
    </span>
  );
}
