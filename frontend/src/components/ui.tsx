import { ReactNode } from 'react';
import { CASE_STATUS_LABEL, CaseStatus, INVENTORY_STATUS_LABEL } from '../types';

const STATUS_CLASS: Record<string, string> = {
  INQUIRY: 'gray', RESERVED: 'blue', APPRAISING: 'amber', APPROVED: 'blue',
  EXECUTED: 'blue', COMPLETED: 'green', CONSIDERING: 'amber', CANCELLED: 'red',
};

export function StatusBadge({ status }: { status: CaseStatus }) {
  return <span className={`badge ${STATUS_CLASS[status] || 'gray'}`}>{CASE_STATUS_LABEL[status]}</span>;
}

const INV_CLASS: Record<string, string> = {
  IN_STOCK: 'blue', LISTED: 'amber', SOLD: 'green', DISPOSED: 'gray', RETURNED: 'red', ON_HOLD: 'gray',
};
export function InventoryBadge({ status }: { status: string }) {
  return <span className={`badge ${INV_CLASS[status] || 'gray'}`}>{INVENTORY_STATUS_LABEL[status] || status}</span>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  );
}

export function Kpi({ label, value, onClick }: { label: string; value: ReactNode; onClick?: () => void }) {
  return (
    <div className="kpi" style={onClick ? { cursor: 'pointer' } : undefined} onClick={onClick}>
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  );
}

export function Internal({ children }: { children?: ReactNode }) {
  return <span className="tag-internal">社内 {children}</span>;
}
