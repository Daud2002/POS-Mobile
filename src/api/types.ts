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

export type OrderStatus =
  | 'pending'
  | 'paid'
  | 'unpaid'
  | 'cancelled'
  | 'refunded'
  | 'completed';

export type PaymentMethod = 'cash' | 'card' | 'check' | 'online';

/** A money value as it arrives from the API — always run through `toNumber()`. */
export type Decimal = number | string;

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
}

export interface LoginResponse {
  accessToken: string;
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
  image?: string;
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
