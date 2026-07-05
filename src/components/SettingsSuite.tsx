import React from 'react';
import SettingsGlobal from './SettingsGlobal';
import PayrollRuleBuilder from './PayrollRuleBuilder';
import PayrollPaymentEngineSettings from './PayrollPaymentEngineSettings';

export default function SettingsSuite(props: any) {
  return (
    <div className="space-y-8">
      <SettingsGlobal {...props} />
      <PayrollPaymentEngineSettings {...props} />
      <PayrollRuleBuilder {...props} />
    </div>
  );
}
