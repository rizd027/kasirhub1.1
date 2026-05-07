import Dexie, { Table } from 'dexie';

export interface LocalTransaction {
  id?: string;
  remote_id?: string;
  total_amount: number;
  subtotal: number;
  tax_amount: number;
  service_charge_amount: number;
  discount_total: number;
  payment_method: 'cash' | 'tempo';
  status: 'paid' | 'unpaid' | 'partial';
  items: any[];
  created_at: string;
  synced: number; // 0 for no, 1 for yes
  customer_name?: string;
  employee_id?: string;
  cashier_name?: string;
  deleted_at?: string; // soft delete
}

export interface LocalProduct {
  id: string;
  sku: string;
  name: string;
  price_sell: number;
  price_cost: number;
  image_url: string;
  category_id: string;
  stock_store: number;
  stock_warehouse: number;
  deleted_at?: string; // soft delete
  barcode_type?: string;
}

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
  note?: string;
  created_at: string;
  synced: number; // 0 for no, 1 for yes
}

export class KasirHubDB extends Dexie {
  transactions!: Table<LocalTransaction>;
  products!: Table<LocalProduct>;
  categories!: Table<any>;
  stock_mutations!: Table<LocalStockMutation>;
  attendance!: Table<LocalAttendance>;
  settings!: Table<{ key: string, value: any }>;

  constructor() {
    super('KasirHubDB');
    this.version(1).stores({
      transactions: '++id, synced, created_at',
      products: 'id, sku, category_id',
      categories: 'id'
    });

    this.version(2).stores({
      transactions: '++id, synced, created_at',
      products: 'id, sku, category_id',
      categories: 'id',
      stock_mutations: '++id, product_id, created_at'
    });

    this.version(3).stores({
      transactions: '++id, synced, created_at',
      products: 'id, sku, category_id, deleted_at',
      categories: 'id',
      stock_mutations: '++id, product_id, created_at'
    });

    this.version(4).stores({
      transactions: '++id, synced, created_at',
      products: 'id, sku, category_id, deleted_at',
      categories: 'id',
      stock_mutations: '++id, product_id, created_at',
      settings: 'key'
    });

    this.version(5).stores({
      transactions: '++id, synced, created_at',
      products: 'id, sku, category_id, deleted_at',
      categories: 'id',
      stock_mutations: '++id, product_id, created_at',
      settings: 'key'
    });

    this.version(6).stores({
      transactions: '++id, synced, created_at',
      products: 'id, sku, category_id, deleted_at',
      categories: 'id',
      stock_mutations: '++id, synced, product_id, created_at',
      attendance: '++id, synced, created_at',
      settings: 'key'
    });

    this.version(7).stores({
      transactions: '++id, synced, created_at',
      products: 'id, sku, category_id, deleted_at',
      categories: 'id',
      stock_mutations: '++id, remote_id, synced, product_id, created_at',
      attendance: '++id, remote_id, synced, created_at',
      settings: 'key'
    });

    this.version(8).stores({
      transactions: '++id, remote_id, synced, created_at',
      products: 'id, sku, category_id, deleted_at',
      categories: 'id',
      stock_mutations: '++id, remote_id, synced, product_id, created_at',
      attendance: '++id, remote_id, synced, created_at',
      settings: 'key'
    });

    this.version(9).stores({
      transactions: '++id, remote_id, synced, created_at, deleted_at',
      products: 'id, sku, category_id, deleted_at',
      categories: 'id',
      stock_mutations: '++id, remote_id, synced, product_id, created_at',
      attendance: '++id, remote_id, synced, created_at',
      settings: 'key'
    });
  }
}


export const db = new KasirHubDB();
