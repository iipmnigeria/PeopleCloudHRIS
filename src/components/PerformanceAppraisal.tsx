import React from 'react';
import PerformanceManagementEngine from './PerformanceManagementEngine';
import BenefitsManagementEngine from './BenefitsManagementEngine';

export default function PerformanceAndBenefitsSuite(props: any) {
  return (
    <div className="space-y-10">
      <PerformanceManagementEngine {...props} />
      <BenefitsManagementEngine {...props} />
    </div>
  );
}
