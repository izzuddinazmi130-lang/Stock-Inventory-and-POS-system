import React from 'react';
import { Select } from './controls';

/**
 * Business first, then branch. The branch list stays locked until a business is chosen and then only
 * shows that business's branches, so head office never sees one long mixed list.
 * Renders two <Select>s as siblings so they sit directly in a FilterBar.
 *
 *   <BusinessBranchFilter businesses={businesses} branches={branches}
 *     businessId={businessId} branchId={branchId}
 *     onBusinessChange={id => { setBusinessId(id); setBranchId(''); }} onBranchChange={setBranchId} />
 *
 * `branches` may be all branches (each with business_id) or already limited to the chosen business.
 * `showBusiness={false}` (branch admins) shows only the branch list, unlocked.
 */
export default function BusinessBranchFilter({
  businesses = [], branches = [], businessId = '', branchId = '',
  onBusinessChange, onBranchChange, showBusiness = true,
  businessClassName = 'md:w-48', branchClassName = 'md:w-48',
}) {
  const locked = showBusiness && !businessId;
  const options = showBusiness && businessId
    ? branches.filter(b => b.business_id == null || String(b.business_id) === String(businessId))
    : branches;

  return (
    <>
      {showBusiness && (
        <Select wrapperClassName={businessClassName} aria-label="Business" value={businessId} onChange={e => onBusinessChange(e.target.value)}>
          <option value="">All businesses</option>
          {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </Select>
      )}
      <Select
        wrapperClassName={branchClassName}
        aria-label="Branch"
        value={locked ? '' : branchId}
        onChange={e => onBranchChange(e.target.value)}
        disabled={locked}
        title={locked ? 'Select a business first to choose its branch' : undefined}
      >
        {locked
          ? <option value="">Select business first</option>
          : <option value="">All branches</option>}
        {!locked && options.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
      </Select>
    </>
  );
}
export { BusinessBranchFilter };
