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
  synced: number;
}

export interface LocalAttendance {
  id?: string;
  remote_id?: string;
  employee_id: string;
  type: 'in' | 'out';
  photo_url: string;
  latitude?: number;
  longitude?: number;
  is_verified: number;
  note?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  sync_status: 'synced' | 'pending' | 'failed';
  synced: number;
}

export interface Category {
    id: string;
    user_id?: string;
    name: string;
    type?: 'product' | 'ingredient' | 'packaging';
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
    note?: string;
    prod_target_batch?: number;
    prod_output_qty?: number;
    prod_wastage_percent?: number;
    prod_tax_efficiency?: number;
    prod_operational_costs?: { name: string; amount: number; type: string }[];
    prod_name?: string;
    prod_monthly_estimate?: number;
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
    cost_at_time: number;
    name_at_time: string;
    discount_details?: any;
    user_id: string;
    created_at: string;
    updated_at: string;
    deleted_at?: string | null;
    sync_status: 'synced' | 'pending' | 'failed';
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
    updated_at: string;
    deleted_at?: string | null;
    sync_status: 'synced' | 'pending' | 'failed';
}

export interface SyncQueue {
    id?: number;
    table_name: string;
    operation: 'insert' | 'update' | 'delete';
    record_id: string;
    payload: any;
    created_at: string;
    retry_count: number;
    last_error?: string;
    last_attempt_at?: string;
    sync_status?: 'pending' | 'failed';
    next_retry_at?: string;
    error_type?: string;
    failed_at?: string;
}

export interface SyncError {
    id?: number;
    table_name: string;
    operation: 'insert' | 'update' | 'delete';
    record_id: string;
    payload: any;
    error_message: string;
    error_code?: string;
    created_at: string;
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
    status?: 'active' | 'removed';
    updated_at: string;
}

export interface Employee {
    id: string;
    user_id: string;
    name: string;
    username?: string;
    password?: string;
    role: string;
    phone?: string;
    whatsapp?: string;
    address?: string;
    gender?: string;
    birth_place?: string;
    birth_date?: string;
    photo_url?: string;
    can_view_reports: boolean;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    deleted_at?: string | null;
    sync_status?: 'synced' | 'pending' | 'failed';
}

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
    sku?: string;
    barcode?: string;
    barcode_type?: string;
    name: string;
    unit: string;
    cost_per_unit: number;
    stock_min?: number;
    stock_current?: number;
    category_id?: string;
    image_url?: string;
    note?: string;
    type?: 'ingredient' | 'packaging';
    updated_at: string;
    deleted_at?: string;
    sync_status: 'synced' | 'pending' | 'failed';
}

export interface ProductIngredient {
    id: string;
    user_id: string;
    product_id: string;
    ingredient_id: string;
    quantity: number;
    is_packaging?: number;
    created_at: string;
    updated_at: string;
    deleted_at?: string | null;
    sync_status: 'synced' | 'pending' | 'failed';
}

export interface HppBatch {
    id: string;
    user_id: string;
    name: string;
    raw_material_id: string;
    raw_material_cost: number;
    raw_material_qty: number;
    raw_material_unit: string;
    batch_qty: number;
    serving_size?: number;
    wastage_pct?: number; 
    contingency_pct?: number; 
    tax_included?: boolean; 
    labour_cost?: number; 
    labor_hours?: number; // Precision labor
    labor_rate?: number; // Precision labor
    shipping_cost?: number; 
    tax_import_cost?: number; 
    insurance_cost?: number;
    handling_fee?: number;
    packaging_cost?: number;
    marketing_insert_cost?: number;
    utility_costs?: number;
    maintenance_costs?: number;
    ads_cost?: number;
    cod_fee_pct?: number;
    return_rate_pct?: number;
    marketplace_admin_fee?: number;
    shipping_subsidy?: number;
    campaign_fee?: number;
    market_price?: number;
    service_duration?: number;
    service_rate?: number;
    recipe_materials?: { name: string; price: number; qty: number; unit: string }[];
    additional_costs: { name: string; price: number; period: string }[];
    derived_products: { name: string; qty: number; unit: string; price_sell: number; allocation_pct: number; target_profit?: number; selected_price?: number; markup_pct?: number }[];
    business_model?: 'production' | 'reseller' | 'culinary' | 'ads_cod' | 'marketplace' | 'service' | 'quick' | 'market_price';
    created_at: string;
    updated_at: string;
    deleted_at?: string | null;
    sync_status?: 'synced' | 'pending' | 'failed';
}

export interface Bundling {
    id: string;
    user_id: string;
    name: string;
    products: { product_id: string; qty: number; original_price: number; hpp: number }[];
    price_sell: number;
    is_active?: boolean;
    sync_status?: 'synced' | 'pending' | 'failed';
    created_at: string;
    updated_at: string;
    deleted_at?: string | null;
}

export interface ProcessingCost {
    id: string;
    user_id: string;
    name: string;
    amount: number;
    period: 'per_batch' | 'per_produk_turunan'; 
    updated_at: string;
    deleted_at?: string;
    sync_status?: 'synced' | 'pending' | 'failed';
}

export class AppDB extends Dexie {
    categories!: Table<Category>;
    products!: Table<Product>;
    transactions!: Table<Transaction>;
    transaction_items!: Table<TransactionItem>;
    stock_logs!: Table<StockLog>;
    sync_queue!: Table<SyncQueue>;
    sync_errors!: Table<SyncError>;
    settings!: Table<Setting>;
    profiles!: Table<Profile>;
    expenses!: Table<Expense>;
    ingredients!: Table<Ingredient>;
    product_ingredients!: Table<ProductIngredient>;
    customer_orders!: Table<any>;
    
    stock_mutations!: Table<LocalStockMutation>;
    attendance!: Table<LocalAttendance>;
    employees!: Table<Employee>;
    hpp_batches!: Table<HppBatch>;
    bundling!: Table<Bundling>;
    processing_costs!: Table<ProcessingCost>;

    constructor() {
        super('KasirHubDB');
        this.version(28).stores({
            categories: 'id, user_id, type, updated_at, sync_status',
            products: 'id, user_id, sku, category_id, updated_at, sync_status, prod_name, prod_target_batch, batch_id',
            transactions: 'id, user_id, employee_id, created_at, updated_at, sync_status',
            transaction_items: 'id, transaction_id, product_id, user_id, sync_status, updated_at',
            stock_logs: 'id, user_id, product_id, created_at',
            sync_queue: '++id, created_at, table_name, record_id, sync_status, next_retry_at',
            sync_errors: '++id, created_at, table_name, record_id',
            settings: 'user_id, updated_at',
            profiles: 'id, slug, updated_at',
            expenses: 'id, user_id, category, created_at, updated_at, sync_status',
            ingredients: 'id, user_id, name, type, sync_status, updated_at',
            product_ingredients: 'id, user_id, product_id, ingredient_id, sync_status, updated_at',
            customer_orders: 'id, user_id, status, updated_at, sync_status',
            stock_mutations: 'id, remote_id, synced, product_id, created_at',
            attendance: 'id, remote_id, created_at, employee_id, sync_status, updated_at',
            employees: 'id, updated_at, sync_status, deleted_at',
            hpp_batches: 'id, user_id, name, created_at, updated_at, sync_status, deleted_at',
            bundling: 'id, user_id, name, created_at, updated_at, sync_status, deleted_at',
            processing_costs: 'id, user_id, name, sync_status, updated_at, deleted_at'
        });
    }
}

export const db = new AppDB();
