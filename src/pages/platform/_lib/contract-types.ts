/** Kiểu theo docs/api/platform-contracts.md và tenant-contracts.md (ADR-0012). Tiền là số nguyên đồng VND; ngày là YYYY-MM-DD giờ Việt Nam. */
export type ContractStatus = "DRAFT" | "ACTIVE" | "EXPIRED" | "CANCELLED";
export type ContractPhase = "UPCOMING" | "IN_EFFECT" | "IN_GRACE";
export type BillingUnit = "DAY" | "MONTH" | "YEAR";
export type BillingCycle = { unit: BillingUnit; value: number };

export type Contract = {
  id: string;
  tenantId: string;
  name: string;
  status: ContractStatus;
  phase: ContractPhase | null;
  inGrace: boolean;
  legacy: boolean;
  modules: string[];
  startDate: string;
  endDate: string | null;
  graceEndsDate: string | null;
  totalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  billingCycle: BillingCycle | null;
  internalNote: string | null;
  modulesAppliedAt: string | null;
  retainedModule: string | null;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type ContractPayment = {
  id: string;
  paidOn: string;
  amount: number;
  reference: string | null;
  note: string | null;
  reversesPaymentId: string | null;
  reversedByPaymentId: string | null;
  recordedBy?: string | null;
  recordedAt: string;
};

export type ContractDetail = Contract & { payments: ContractPayment[] };

export type TenantContractList = {
  contracts: Contract[];
  enabledModules: string[];
  modulesOutsideContract: string[];
};

export type ContractHistoryEntry = {
  id: string;
  type: string;
  contractId: string;
  actorType: "USER" | "SYSTEM";
  actorId: string | null;
  occurredAt: string;
  data?: Record<string, unknown> | null;
};

export type ExpiringContract = {
  contractId: string;
  tenantId: string;
  tenantCode: string;
  tenantName: string;
  name: string;
  endDate: string;
  daysLeft: number;
  inGrace: boolean;
  graceEndsDate: string | null;
  outstandingAmount: number;
};

export type ContractFormValues = {
  name: string;
  modules: string[];
  startDate: string;
  endDate: string;
  totalAmount: number;
  billingCycle?: BillingCycle | null;
  internalNote?: string | null;
};

/** GET /api/contracts, /api/contracts/current (tenant admin, chỉ đọc; không có giá từng module, ghi chú, thanh toán). */
export type TenantContractView = {
  id: string;
  name: string;
  status: Exclude<ContractStatus, "DRAFT">;
  phase: ContractPhase | null;
  inGrace: boolean;
  graceEndsDate: string | null;
  modules: string[];
  startDate: string;
  endDate: string | null;
  totalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  billingCycle: BillingCycle | null;
};
