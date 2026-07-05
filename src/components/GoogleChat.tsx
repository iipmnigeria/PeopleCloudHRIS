import React from 'react';
import SmartWorkforceHub from './SmartWorkforceHub';
import OfflineModeIndicator from './OfflineModeIndicator';
import EmployeeExperienceSuite from './EmployeeExperienceSuite';
import { UserRole } from '../types';

interface GoogleChatProps {
  currentUser: {
    uid: string;
    email: string;
    displayName: string;
    role: UserRole;
    companyId: string | null;
  };
  selectedTenantId: string;
}

export default function GoogleChat(props: GoogleChatProps) {
  return (
    <div className="space-y-8">
      <EmployeeExperienceSuite {...props} />
      <SmartWorkforceHub {...props} />
      <OfflineModeIndicator />
    </div>
  );
}
