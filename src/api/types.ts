/**
 * DTOs mirroring the NestJS entities in Backend/src/entities.
 *
 * Two things to keep in mind, both inherited from the backend:
 *  - TypeORM returns Postgres `decimal` columns as STRINGS on /orders (the
 *    /invoices endpoint coerces them server-side). Every money field is typed
 *    `number | string` and must be read through `toNumber()` from lib/format.
 *  - `storeId` is not in the JWT payload; it is grafted on by /auth/me.
 */

export type UserRole = 'admin' | 'store_owner' | 'employee';

export type AccountType = 'general' | 'restaurant';

export type EffectiveRole =
  | 'super_admin'
  | 'store_owner'
  | 'restaurant_owner'
  | 'waiter'
  | 'kitchen'
  | 'cashier';

/**
 * A module a user may be granted, mirroring Backend/src/common/permissions.ts.
 *
 * `pos` and `cashier` are both "the till" but are different screens — one per
 * account type — so they stay distinct.
 */
export type PermissionKey =
  | 'dashboard'
  | 'expenses'
  | 'pos'
  | 'cashier'
  | 'kitchen'
  | 'tables'
  | 'products'
  | 'categories'
  | 'orders'
  | 'customers'
  | 'inventory';

export type OrderStatus =
  | 'pending'
  | 'paid'
  | 'unpaid'
  | 'cancelled'
  | 'refunded'
  | 'completed';

export type PaymentMethod = 'cash' | 'card' | 'check' | 'online';

/**
 * Restaurant lifecycle, deliberately a separate union from OrderStatus.
 *
 * Widening OrderStatus would break `Record<OrderStatus, StatusTone>` in
 * constants/statuses.ts and every general-account screen that maps over it.
 * 'none' marks an order that is not part of the restaurant flow.
 */
export type RestaurantOrderStatus =
  | 'none'
  | 'draft'
  | 'requested'
  | 'preparing'
  /** Cooked and passed to the floor. Still unpaid, still holds its table. */
  | 'handed_over'
  | 'completed'
  | 'cancelled';

/** 'dine_out' eats in AND takes a parcel home, so it needs a table too. */
export type RestaurantOrderType =
  | 'none'
  | 'dine_in'
  | 'dine_out'
  | 'takeaway'
  | 'delivery';

export type TableStatus = 'free' | 'reserved';

export interface RestaurantTable {
  id: string;
  storeId: string;
  name: string;
  status: TableStatus;
  currentOrderId?: string | null;
  isActive: boolean;
}

export interface RestaurantOrderItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: Decimal;
  unitCost?: Decimal | null;
  total: Decimal;
  notes?: string | null;
  /** Pack this line to go, on a dine_out order that also eats in. */
  isParcel?: boolean;
  /** Which round this line belongs to. Null while still a draft. */
  sentAt?: string | null;
}

export interface RestaurantOrder {
  id: string;
  /** Internal, globally-unique. Display `orderSequence` instead. */
  orderNumber: string;
  /** Per-store display number, counting from 1. */
  orderSequence?: number | null;
  storeId: string;
  orderStatus: RestaurantOrderStatus;
  orderType: RestaurantOrderType;
  /** Mirror of the legacy `status` column, exposed under a clearer name. */
  paymentStatus: OrderStatus;
  status: OrderStatus;
  tableId?: string | null;
  tableName?: string | null;
  waiterName?: string | null;
  /** Who TOOK THE MONEY — a cashier, never the waiter. Null until paid. */
  settledByName?: string | null;
  settledById?: string | null;
  settledAt?: string | null;
  /** The cashier shift this payment landed in. */
  shiftId?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  deliveryAddress?: string | null;
  items: RestaurantOrderItem[];
  subtotal: Decimal;
  discount: Decimal;
  discountType?: 'amount' | 'percent' | null;
  discountValue?: Decimal | null;
  total: Decimal;
  paymentMethod?: PaymentMethod | null;
  notes?: string | null;
  version: number;
  createdAt: string;
}

export interface RestaurantOrderItemPayload {
  productId: string;
  quantity: number;
  notes?: string;
  isParcel?: boolean;
}

export interface CreateRestaurantOrderPayload {
  orderType: 'dine_in' | 'dine_out' | 'takeaway' | 'delivery';
  tableId?: string;
  items: RestaurantOrderItemPayload[];
  isDraft?: boolean;
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  notes?: string;
}

/** Envelope returned when an endpoint is called with `withCount=true`. */
export interface Paged<T> {
  items: T[];
  total: number;
  skip: number;
  take: number;
}

export interface RestaurantSalesReport {
  orderCount: number;
  revenue: number;
  cost: number;
  profit: number;
  discountTotal: number;
  averageOrderValue: number;
  /** Lines sold with no cost price recorded — profit is overstated by these. */
  unknownCostLineCount: number;
  topProducts: { name: string; quantity: number; revenue: number; profit: number }[];
  byWaiter: { name: string; orders: number; revenue: number }[];
  /** Who COLLECTED the money, as opposed to who took the order. */
  byCashier: { name: string; orders: number; revenue: number }[];
  byOrderType: { orderType: string; orders: number; revenue: number }[];
}

/** A money value as it arrives from the API — always run through `toNumber()`. */
export type Decimal = number | string;

// ------------------------------------------------------------ cashier shifts

export type CashierShiftStatus = 'open' | 'closed' | 'collected';

/** Money taken during a shift, split the way an owner counts it. */
export interface ShiftTotals {
  cashSales: number;
  cardSales: number;
  onlineSales: number;
  otherSales: number;
  totalSales: number;
  orderCount: number;
  cashPaidOut: number;
  /** openingFloat + cashSales − cashPaidOut. Only cash touches the drawer. */
  expectedCash: number;
}

export interface CashierShift {
  id: string;
  storeId: string;
  userId: string;
  status: CashierShiftStatus;
  openedAt: string;
  openingFloat: number;
  closedAt?: string | null;
  cashierName?: string | null;
  closedByName?: string | null;
  collectedByName?: string | null;
  /** Frozen at close; null while the shift is still open. */
  cashSales?: number | null;
  cardSales?: number | null;
  onlineSales?: number | null;
  otherSales?: number | null;
  totalSales?: number | null;
  orderCount?: number | null;
  cashPaidOut?: number | null;
  expectedCash?: number | null;
  /** Null after an owner force-close — nobody counted the drawer. */
  countedCash?: number | null;
  difference?: number | null;
  closingNotes?: string | null;
  collectedAmount?: number | null;
  collectedAt?: string | null;
  collectionNotes?: string | null;
  /** Live for an open shift, the snapshot for a closed one. */
  totals?: ShiftTotals;
}

export interface CashierShiftDetail extends CashierShift {
  orders: RestaurantOrder[];
}

export interface CashierDashboard {
  range: {
    cash: number;
    card: number;
    online: number;
    other: number;
    total: number;
    orderCount: number;
  };
  currentShift: CashierShift | null;
  recentShifts: CashierShift[];
}

/** One row of the owner's "who collected what" table. */
export interface CashierSummaryRow {
  userId: string;
  name: string;
  shifts: number;
  openNow: boolean;
  orders: number;
  cashSales: number;
  cardSales: number;
  onlineSales: number;
  otherSales: number;
  totalSales: number;
  cashPaidOut: number;
  expectedCash: number;
  countedCash: number;
  difference: number;
  collectedAmount: number;
  /** Counted and closed, but not yet handed to the owner. */
  pendingCollection: number;
}

export interface AppUser {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  /** Present only for store_owner and employee; resolved by /auth/me. */
  storeId?: string;
  currency?: string;
  /**
   * The QZ Tray printer NAME configured for the store (e.g. "BP-80"). It is a
   * Windows printer name and therefore meaningless on mobile — the mobile
   * printer binding lives in local storage instead. Kept only for reference.
   */
  printerConfig?: string;
  /** 'general' keeps today's flow; 'restaurant' unlocks the table-service screens. */
  accountType?: AccountType;
  /**
   * Store identity and tenant flags, grafted onto the profile by /auth/me so
   * screens do not each have to fetch the store to know its name or whether
   * the till requires an open shift.
   */
  storeName?: string;
  logoUrl?: string | null;
  shiftsEnabled?: boolean;
  /** Employee job title. Only meaningful for restaurant tenants. */
  designation?: string;
  printerName?: string;
  /**
   * Server-derived from (role x accountType x designation) — the single value
   * navigation branches on. `role` above is untouched and still drives every
   * existing general-account screen.
   */
  effectiveRole?: EffectiveRole;
  /**
   * Modules this user may open, resolved server-side. Absent when the app is
   * talking to a backend that predates permissions — `permissionsOf()` in
   * lib/access.ts derives a fallback, which matters because a store build can
   * lag the API by a release.
   */
  permissions?: PermissionKey[];
}

export interface LoginResponse {
  accessToken: string;
  /**
   * Opaque, 7-day, rotated on every use. Persisted in SecureStore; it is what
   * keeps a user signed in past the 30-minute access token.
   */
  refreshToken: string;
  user: AppUser;
}

export interface Store {
  id: string;
  userId?: string;
  name: string;
  type?: string;
  plan: string;
  currency: string;
  address?: string;
  phone?: string;
  email?: string;
  printerConfig?: string;
  /** Server-relative; join onto API_BASE_URL before using it as an image src. */
  logoUrl?: string | null;
  /** Restaurant tenants only: cashiers must open a shift before settling. */
  shiftsEnabled?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  storeId?: string;
  name: string;
  description?: string;
  image?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  storeId?: string;
  name: string;
  description?: string;
  price: Decimal;
  costPrice?: Decimal;
  stock: number;
  lowStockAlertQuantity?: number;
  sku?: string;
  barcode?: string;
  /** Holds an EMOJI, not a URL — e.g. '📦'. The API field is `image`. */
  image?: string;
  isActive: boolean;
  categoryId?: string;
  category?: Category;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone: string;
  address: string;
  city?: string;
  totalSpent: Decimal;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  productName?: string;
  quantity: number;
  unitPrice: Decimal;
  subtotal: Decimal;
  /** The LINE total discount (perUnit × qty), not a per-unit amount. */
  discount: Decimal;
  total: Decimal;
}

export interface Order {
  id: string;
  storeId?: string;
  orderNumber: string;
  customerId?: string;
  customer?: Customer;
  customerName?: string;
  createdById: string;
  status: OrderStatus;
  subtotal: Decimal;
  tax: Decimal;
  discount: Decimal;
  total: Decimal;
  notes?: string;
  paymentMethod?: PaymentMethod;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
}

export interface Employee {
  id: string;
  storeId: string;
  userId: string;
  employeeId: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  salary?: Decimal;
  joinDate?: string;
  designation: string;
  createdAt: string;
  updatedAt: string;
  /** Employee has no isActive column — it lives on the linked User. */
  user?: { id: string; isActive: boolean };
  /**
   * Modules granted ON TOP of the one the designation always carries. Null
   * means never customised. Read via the /permissions endpoint rather than
   * this field, which the list endpoint may not populate.
   */
  permissions?: string[] | null;
}

/** GET /employees/:id/permissions — what they hold and what may be added. */
export interface EmployeePermissions {
  employeeId: string;
  designation: string;
  /** Always held; not revocable. */
  base: PermissionKey;
  /** What the owner may additionally assign to this designation. */
  grantable: PermissionKey[];
  /** base + granted. */
  permissions: PermissionKey[];
}

/** Owner-maintained bucket an expense is filed under. */
export interface ExpenseCategory {
  id: string;
  storeId: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ExpensePaymentMethod = 'cash' | 'card' | 'bank' | 'other';

/**
 * A spend booked against the store — one shared ledger, not a personal one.
 *
 * `expenseDate` is a plain 'YYYY-MM-DD', never a timestamp: it is the store's
 * calendar day, so it must not be run through `new Date()` for display or the
 * device timezone can shift it a day.
 */
export interface Expense {
  id: string;
  storeId: string;
  categoryId?: string | null;
  title: string;
  amount: Decimal;
  expenseDate: string;
  paymentMethod?: ExpensePaymentMethod | null;
  notes?: string | null;
  createdById?: string | null;
  createdAt: string;
  updatedAt: string;
  category?: ExpenseCategory | null;
  createdBy?: { id: string; name: string } | null;
}

export interface ExpensePayload {
  title: string;
  amount: number;
  categoryId?: string | null;
  expenseDate?: string;
  paymentMethod?: ExpensePaymentMethod;
  notes?: string;
}

export interface ExpenseSummary {
  /** The day these figures cover, echoed back. */
  date: string;
  today: number;
  todayCount: number;
  month: number;
  monthCount: number;
}

/** Response of GET /invoices/:orderId. All decimals are coerced server-side. */
export interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  order: {
    id: string;
    orderNumber: string;
    createdAt: string;
    status: OrderStatus;
    subtotal: number;
    tax: number;
    discount: number;
    total: number;
    paymentMethod?: PaymentMethod;
    items: Array<{
      productName: string;
      quantity: number;
      unitPrice: number;
      discount: number;
      subtotal: number;
      total: number;
    }>;
  };
  customer?: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    address?: string;
  };
  store?: {
    id: string;
    name: string;
    address?: string;
    phone?: string;
    email?: string;
    currency?: string;
  };
}

// --- Request payloads -------------------------------------------------------

export interface CreateOrderItemPayload {
  productId: string;
  quantity: number;
  unitPrice: number;
  /** Line total discount, i.e. perUnitDiscount × quantity. */
  discount: number;
}

export interface CreateOrderPayload {
  paymentMethod: PaymentMethod | null;
  customerId?: string;
  tax: number;
  discount: number;
  status: OrderStatus;
  notes: string;
  /** The server trusts this verbatim — see lib/orderMath.ts. */
  total: number;
  items: CreateOrderItemPayload[];
}

export interface ProductPayload {
  name: string;
  description?: string;
  price: number;
  costPrice?: number;
  stock: number;
  lowStockAlertQuantity?: number;
  sku?: string;
  barcode?: string;
  image?: string;
  categoryId?: string;
  isActive?: boolean;
}

export interface CategoryPayload {
  name: string;
  description?: string;
  /** An emoji. Null clears it — undefined would leave a PATCH untouched. */
  image?: string | null;
  /** The web app omits this, which is a bug — mobile always sends it. */
  storeId?: string;
}

export interface CustomerPayload {
  name: string;
  phone: string;
  address: string;
  email?: string;
  city?: string;
}

export interface ExpenseCategoryPayload {
  name: string;
  description?: string;
  isActive?: boolean;
}

export interface EmployeePayload {
  employeeId?: string;
  name: string;
  email: string;
  password?: string;
  phone?: string;
  address?: string;
  salary?: number;
  joinDate?: string;
  designation?: string;
  isActive?: boolean;
}
