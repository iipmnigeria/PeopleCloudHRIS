import React from 'react';
import SmartWorkforceHub from './SmartWorkforceHub';
import OfflineModeIndicator from './OfflineModeIndicator';

interface GoogleChatProps {
  currentUser: {
    uid: string;
    email: string;
    displayName: string;
    role: string;
    companyId: string | null;
  };
  selectedTenantId: string;
}

export default function GoogleChat(props: GoogleChatProps) {
  return (
    <>
      <SmartWorkforceHub {...props} />
      <OfflineModeIndicator />
    </>
  );
}
