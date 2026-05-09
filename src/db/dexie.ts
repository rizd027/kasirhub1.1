import Dexie, { Table } from 'dexie';

export interface LocalStockMutation {
  id?: string;
  remote_id?: string;
  product_id: string;
  type: 'add' | 'reduce' | 'transfer_in' | 'transfer_out' | 'set';
  from_location?: 'store' | 'warehouse';
  to_location?: 'store' | 'warehouse';
  qty: number;
  note?: string;
  created_at: string;
  synced: number; // 0 for no, 1 for yes
}

export interface LocalAttendance {
  id?: string;
  remote_id?: string;
  employee_id: string;
  type: 'in' | 'out';
  photo_url: string;
  latitude?: number;
  longitude?: number;
  is_verified: number; // 0 for no, 1 for yes
  note?: string;
  created_at: string;
  synced: number; // 0 for no, 1 for yes
}

export interface Category {
    id: string;
    user_id?: string;
    name: string;
    created_at?: string;
    updated_at?: string;
    deleted_at?: string | null;
    sync_status?: 'synced' | 'pending' | 'failed';
}

export interface Product {
    id: string;
    user_id?: string;
    sku: string;
    name: string;
    category_id: string;
    price_cost: number;
    price_sell: number;
    image_url: string;
    barcode_type?: string;
    stock_store: number;
    stock_warehouse: number;
    created_at?: string;
    updated_at?: string;
    deleted_at?: string | null;
    sync_status?: 'synced' | 'pending' | 'failed';
}

export interface Transaction {
    id: string;
    user_id: string;
    employee_id?: string;
    total_amount: number;
    subtotal: number;
    tax_amount: number;
    service_charge_amount: number;
    discount_total: number;
    payment_method: 'cash' | 'tempo' | 'qris' | 'transfer';
    status: 'paid' | 'unpaid' | 'partial';
    customer_name?: string;
    cashier_name?: string;
    created_at: string;
    updated_at: string;
    deleted_at?: string | null;
    sync_status: 'synced' | 'pending' | 'failed';
    items: TransactionItem[];
}

export interface TransactionItem {
    id: string;
    transaction_id: string;
    product_id: string;
    quantity: number;
    price_at_time: number;
    cost_at_time: number; // HPP saat transaksi
    name_at_time: string;
    discount_details?: any;
}

export interface StockLog {
    id: string;
    user_id: string;
    product_id: string;
    change_amount: number;
    type: string;
    location: string;
    reference_id?: string;
    created_at: string;
}

export interface SyncQueue {
    id?: number;
    table_name: string;
    operation: 'insert' | 'update' | 'delete';
    record_id: string;
    payload: any;
    created_at: string;
    retry_count: number;
}

export interface Setting {
    user_id: string;
    toko_info: any;
    pin_code?: string | null;
    preferences: any;
    updated_at: string;
}

export interface Profile {
    id: string;
    role: string;
    full_name: string;
    store_name?: string;
    slug?: string;
    photo_url?: string;
    updated_at: string;
}

export interface Employee {
    id: string;
    user_id: string;
    name: string;
    role: string;
    pin?: string;
    updated_at: string;
}

// Aliases for legacy UI components
export type LocalProduct = Product;
export type LocalTransaction = Transaction;

export interface Expense {
    id: string;
    user_id: string;
    employee_id?: string;
    amount: number;
    category: string;
    note?: string;
    created_at: string;
    updated_at: string;
    deleted_at?: string | null;
    sync_status: 'synced' | 'pending' | 'failed';
}

export interface Ingredient {
    id: string;
    user_id: string;
    name: string;
    unit: string;
    cost_per_unit: number;
    updated_at: string;
    deleted_at?: string;
    sync_status: 'synced' | 'pending' | 'failed';
}

export interface ProductIngredient {
    id: string;
    product_id: string;
    ingredient_id: string;
    quantity: number;
    sync_status?: 'synced' | 'pending' | 'failed';
}

export class AppDB extends Dexie {
    categories!: Table<Category>;
    products!: Table<Product>;
    transactions!: Table<Transaction>;
    transaction_items!: Table<TransactionItem>;
    stock_logs!: Table<StockLog>;
    sync_queue!: Table<SyncQueue>;
    settings!: Table<Setting>;
    profiles!: Table<Profile>;
    expenses!: Table<Expense>;
    ingredients!: Table<Ingredient>;
    product_ingredients!: Table<ProductIngredient>;
    
    // Legacy tables
    stock_mutations!: Table<LocalStockMutation>;
    attendance!: Table<LocalAttendance>;
    employees!: Table<Employee>;

    constructor() {
        super('KasirHubDB');
        this.version(19).stores({
            categories: 'id, user_id, updated_at, sync_status',
            products: 'id, user_id, sku, category_id, updated_at, sync_status',
            transactions: 'id, user_id, employee_id, created_at, sync_status',
            transaction_items: 'id, transaction_id, product_id',
            stock_logs: 'id, user_id, product_id, created_at',
            sync_queue: '++id, created_at, table_name, record_id',
            settings: 'user_id',
            profiles: 'id, slug',
            expenses: 'id, user_id, category, created_at, sync_status',
            ingredients: 'id, user_id, name, sync_status',
            product_ingredients: 'id, product_id, ingredient_id, sync_status',
            stock_mutations: '++id, remote_id, synced, product_id, created_at',
            attendance: '++id, remote_id, synced, created_at, employee_id, is_verified',
            employees: 'id'
        });
    }
}

export const db = new AppDB();
