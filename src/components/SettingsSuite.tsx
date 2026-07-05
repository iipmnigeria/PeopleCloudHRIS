import React from 'react';
import SettingsGlobal from './SettingsGlobal';
import PayrollRuleBuilder from './PayrollRuleBuilder';

export default function SettingsSuite(props: any) {
  return (
    <div className="space-y-8">
      <SettingsGlobal {...props} />
      <PayrollRuleBuilder {...props} />
    </div>
  );
}
