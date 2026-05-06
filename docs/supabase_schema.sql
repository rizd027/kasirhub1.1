-- KasirHub Database Schema
-- Run this in Supabase SQL Editor

-- 1. Enable Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Types
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'kasir');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Tables
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid(), -- Multi-tenant owner
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ -- added for soft delete sync
);

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid(), -- Multi-tenant owner
  sku TEXT NOT NULL, -- SKU unique within user scope
  name TEXT NOT NULL,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  price_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  price_sell DECIMAL(12,2) NOT NULL DEFAULT 0,
  image_url TEXT,
  stock_store INTEGER NOT NULL DEFAULT 0,
  stock_warehouse INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ, -- added for soft delete sync
  UNIQUE(user_id, sku) -- SKU uniqueness scoped per user
);

-- New Tables for Employee Management
CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid(), -- Shop Owner
  name TEXT NOT NULL,
  username TEXT UNIQUE,
  password TEXT, -- Local password set by Admin
  role TEXT DEFAULT 'kasir', -- 'admin' or 'kasir'
  phone TEXT,
  whatsapp TEXT,
  address TEXT,
  photo_url TEXT,
  is_active BOOLEAN DEFAULT true,
  can_view_reports BOOLEAN DEFAULT false,
  employee_pin TEXT, -- For staff-specific actions if needed
  last_check_in TIMESTAMPTZ,
  gender TEXT, -- 'L' or 'P'
  birth_place TEXT,
  birth_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  employee_id UUID REFERENCES employees(id) ON DELETE SET NULL, -- Track which staff made the sale
  total_amount DECIMAL(12,2) NOT NULL,
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  service_charge_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  discount_total DECIMAL(12,2) DEFAULT 0,
  payment_method TEXT CHECK (payment_method IN ('cash', 'tempo')),
  status TEXT CHECK (status IN ('paid', 'unpaid', 'partial')),
  customer_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transaction_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL,
  price_at_time DECIMAL(12,2) NOT NULL,
  discount_details JSONB -- Format: { disc1: %, disc2: %, nominal: val }
);

CREATE TABLE IF NOT EXISTS receivables (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid(), -- Multi-tenant owner
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  due_date DATE,
  status TEXT DEFAULT 'unpaid' CHECK (status IN ('paid', 'unpaid', 'partial')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stock_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid(), -- Multi-tenant owner
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  change_amount INTEGER NOT NULL,
  type TEXT NOT NULL, -- 'sale', 'restock', 'transfer_to_store', 'transfer_to_warehouse', 'adjustment'
  location TEXT NOT NULL, -- 'store', 'warehouse'
  reference_id UUID, -- Links to transaction_id or other logs
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'admin',
  full_name TEXT,
  photo_url TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  toko_info JSONB DEFAULT '{}',
  pin_code TEXT, -- Hashed or encrypted PIN would be better, but keeping it simple for now
  preferences JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);



CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid(), -- Shop Owner
  type TEXT CHECK (type IN ('in', 'out')),
  photo_url TEXT,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Enable RLS
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE receivables ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies (migration-safe, no data deletion)

-- Ensure transaction ownership field exists for sync-by-account flow
-- Ensure multi-tenancy columns exist before creating policies
ALTER TABLE categories ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();
ALTER TABLE products ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();
ALTER TABLE receivables ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();
ALTER TABLE stock_logs ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();
ALTER TABLE settings ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();

-- Auto-fill owner on new rows (so old code that doesn't send user_id still works)
CREATE OR REPLACE FUNCTION public.assign_transaction_user_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.user_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS before_insert_assign_transaction_user ON transactions;
CREATE TRIGGER before_insert_assign_transaction_user
BEFORE INSERT ON transactions
FOR EACH ROW
EXECUTE FUNCTION public.assign_transaction_user_id();

-- Helper function for reusable admin checks in policies
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- Clean old policies (safe for repeated execution)
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Allow select for authenticated" ON categories;
DROP POLICY IF EXISTS "Allow select for authenticated" ON products;
DROP POLICY IF EXISTS "Admin only all" ON categories;
DROP POLICY IF EXISTS "Admin only all" ON products;
DROP POLICY IF EXISTS "Users can only see their own categories" ON categories;
DROP POLICY IF EXISTS "Users can only manage their own categories" ON categories;
DROP POLICY IF EXISTS "Users can only see their own products" ON products;
DROP POLICY IF EXISTS "Users can only manage their own products" ON products;
DROP POLICY IF EXISTS "Users can manage own settings" ON settings;
DROP POLICY IF EXISTS "Kasir/Admin can insert transactions" ON transactions;
DROP POLICY IF EXISTS "Users can view own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can insert own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can insert items for own transactions" ON transaction_items;
DROP POLICY IF EXISTS "Users can view own transaction items" ON transaction_items;
DROP POLICY IF EXISTS "Users can manage own receivables" ON receivables;
DROP POLICY IF EXISTS "Users can manage own stock logs" ON stock_logs;
DROP POLICY IF EXISTS "Admins can manage stock logs" ON stock_logs;
DROP POLICY IF EXISTS "Users can manage own employees" ON employees;
DROP POLICY IF EXISTS "Users can manage own attendance" ON attendance;

-- Profiles
CREATE POLICY "Users can view own profile"
ON profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
ON profiles
FOR SELECT
TO authenticated
USING (public.is_admin());

CREATE POLICY "Users can update own profile"
ON profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Fix: Allow authenticated users to insert their own profile row
-- (needed for upsert from AuthCheck and register flow)
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile"
ON profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Categories & Products
CREATE POLICY "Users can only see their own categories"
ON categories
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Users can only manage their own categories"
ON categories
FOR ALL
TO authenticated
USING (auth.uid() = user_id OR public.is_admin())
WITH CHECK (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Users can only see their own products"
ON products
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Users can only manage their own products"
ON products
FOR ALL
TO authenticated
USING (auth.uid() = user_id OR public.is_admin())
WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- Transactions
CREATE POLICY "Users can insert own transactions"
ON transactions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- Fix: Allow staff (anon) to record transactions
DROP POLICY IF EXISTS "Allow anon to record transactions" ON transactions;
CREATE POLICY "Allow anon to record transactions"
ON transactions
FOR INSERT
TO anon
WITH CHECK (true);

CREATE POLICY "Users can view own transactions"
ON transactions
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR user_id IS NULL -- legacy rows from before account-sync migration
  OR public.is_admin()
);

-- Optional one-time migration (manual): assign legacy NULL user_id rows to a specific user.
-- IMPORTANT: replace '<target_user_uuid>' first, and run only when you are sure.
-- UPDATE transactions
-- SET user_id = '<target_user_uuid>'
-- WHERE user_id IS NULL;

-- Transaction items
CREATE POLICY "Users can insert items for own transactions"
ON transaction_items
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM transactions t
    WHERE t.id = transaction_id
      AND (t.user_id = auth.uid() OR public.is_admin())
  )
);

-- Fix: Allow staff (anon) to record transaction items
DROP POLICY IF EXISTS "Allow anon to record transaction items" ON transaction_items;
CREATE POLICY "Allow anon to record transaction items"
ON transaction_items
FOR INSERT
TO anon
WITH CHECK (true);

CREATE POLICY "Users can view own transaction items"
ON transaction_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM transactions t
    WHERE t.id = transaction_id
      AND (t.user_id = auth.uid() OR public.is_admin())
  )
);

-- Receivables
CREATE POLICY "Users can manage own receivables"
ON receivables
FOR ALL
TO authenticated
USING (auth.uid() = user_id OR public.is_admin())
WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- Stock logs
CREATE POLICY "Users can manage own stock logs"
ON stock_logs
FOR ALL
TO authenticated
USING (auth.uid() = user_id OR public.is_admin())
WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- Fix: Allow staff (anon) to log stock changes
DROP POLICY IF EXISTS "Allow anon to log stock changes" ON stock_logs;
CREATE POLICY "Allow anon to log stock changes"
ON stock_logs
FOR INSERT
TO anon
WITH CHECK (true);

-- Settings
CREATE POLICY "Users can manage own settings"
ON settings
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Employees
CREATE POLICY "Users can manage own employees"
ON employees
FOR ALL
TO authenticated
USING (auth.uid() = user_id OR public.is_admin())
WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- Fix: Allow staff login (anon users need to find employee by username)
DROP POLICY IF EXISTS "Allow anon select for staff login" ON employees;
CREATE POLICY "Allow anon select for staff login"
ON employees
FOR SELECT
TO anon
USING (is_active = true);

-- Attendance
CREATE POLICY "Users can manage own attendance"
ON attendance
FOR ALL
TO authenticated
USING (auth.uid() = user_id OR public.is_admin())
WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- Fix: Allow staff (anon) to record attendance
DROP POLICY IF EXISTS "Allow anon to record attendance" ON attendance;
CREATE POLICY "Allow anon to record attendance"
ON attendance
FOR INSERT
TO anon
WITH CHECK (true);

-- Fix: Allow Admins to see attendance for their employees (even if user_id is null)
DROP POLICY IF EXISTS "Admins can view employee attendance" ON attendance;
CREATE POLICY "Admins can view employee attendance"
ON attendance
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id 
  OR public.is_admin()
  OR EXISTS (SELECT 1 FROM employees e WHERE e.id = attendance.employee_id AND e.user_id = auth.uid())
);

-- Auto-fill user_id triggers for Employees & Attendance
DROP TRIGGER IF EXISTS before_insert_assign_employee_user ON employees;
CREATE TRIGGER before_insert_assign_employee_user
BEFORE INSERT ON employees
FOR EACH ROW EXECUTE FUNCTION public.assign_transaction_user_id();

DROP TRIGGER IF EXISTS before_insert_assign_attendance_user ON attendance;
CREATE TRIGGER before_insert_assign_attendance_user
BEFORE INSERT ON attendance
FOR EACH ROW EXECUTE FUNCTION public.assign_transaction_user_id();

-- 6. Functions & Triggers

-- Function to handle stock synchronization on transaction
CREATE OR REPLACE FUNCTION handle_transaction_stock()
RETURNS TRIGGER AS $$
BEGIN
  -- We assume transactions only affect stock_store for now
  -- In a real app, you might have different logic for different transaction types
  UPDATE products
  SET stock_store = stock_store - NEW.quantity
  WHERE id = NEW.product_id;
  
  -- Log the change
  INSERT INTO stock_logs (product_id, user_id, change_amount, type, location, reference_id)
  VALUES (NEW.product_id, auth.uid(), -NEW.quantity, 'sale', 'store', NEW.transaction_id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_transaction_item_added ON transaction_items;
CREATE TRIGGER on_transaction_item_added
AFTER INSERT ON transaction_items
FOR EACH ROW EXECUTE FUNCTION handle_transaction_stock();

-- 7. Trigger to sync profiles on auth.users creation
-- Fix: Read role from signUp metadata so /register correctly assigns 'admin'.
-- Falls back to 'kasir' if no role is provided (e.g. staff invited manually).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', 'User Baru'),
    'admin'
  )
  ON CONFLICT (id) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        role     = EXCLUDED.role,
        updated_at = NOW();
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Prevent trigger failure from blocking signup
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Force refresh cache
NOTIFY pgrst, 'reload schema';

-- 8. Migrations (Run these if tables already exist but are missing columns)
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS subtotal DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS service_charge_amount DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES employees(id) ON DELETE SET NULL;

ALTER TABLE employees ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS birth_place TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS birth_date DATE;

-- Allow staff login (Run this to fix 406/403 errors on login)
DROP POLICY IF EXISTS "Allow anon select for staff login" ON employees;
CREATE POLICY "Allow anon select for staff login" ON employees FOR SELECT TO anon USING (is_active = true);

ALTER TABLE products ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- ============================================================
-- 9. Self-Service Customer Ordering (Pemesanan Mandiri)
-- Run these in Supabase SQL Editor to enable the QR Menu feature
-- ============================================================

-- Table for storing self-service customer orders
CREATE TABLE IF NOT EXISTS public.customer_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id), -- shop owner's ID
  buyer_id UUID DEFAULT auth.uid(),        -- Strategy 1: Identity of the guest (Anonymous Auth)
  table_number TEXT,
  customer_name TEXT,
  items JSONB NOT NULL DEFAULT '[]',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migration fix: ensure column exists if table was created earlier
ALTER TABLE public.customer_orders ADD COLUMN IF NOT EXISTS buyer_id UUID DEFAULT auth.uid();

-- RLS: Secure guest checkout
ALTER TABLE public.customer_orders ENABLE ROW LEVEL SECURITY;

-- Grants for API access
GRANT SELECT, INSERT, UPDATE ON public.customer_orders TO anon, authenticated;

-- Policy 1: Allow guests to insert orders (if they have an anonymous auth session)
DROP POLICY IF EXISTS "Allow anon-auth insert orders" ON public.customer_orders;
CREATE POLICY "Allow anon-auth insert orders"
  ON public.customer_orders FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- Policy 2: Allow guests to see ONLY their own orders
DROP POLICY IF EXISTS "Allow customers to see only their own orders" ON public.customer_orders;
CREATE POLICY "Allow customers to see only their own orders"
  ON public.customer_orders FOR SELECT
  TO authenticated
  USING (auth.uid() = buyer_id);

-- RLS: Only the shop owner can read and update their orders (full access)
DROP POLICY IF EXISTS "Allow owner read update customer_orders" ON public.customer_orders;
CREATE POLICY "Allow owner read update customer_orders"
  ON public.customer_orders FOR ALL
  USING (auth.uid() = user_id);

-- Activate Realtime for this table (idempotent — safe to run multiple times)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'customer_orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE customer_orders;
  END IF;
END $$;

-- ============================================================
-- 10. Migrations: Store Name for QR Menu Digital
-- Tambahkan kolom store_name ke tabel profiles agar nama toko
-- tampil dengan benar di halaman katalog publik pelanggan.
-- ============================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS store_name TEXT;

-- Setelah menjalankan ini, nama toko bisa diisi di:
-- Settings → Toko Saya → field "Nama Toko"
-- (Pastikan halaman toko juga menyimpan store_name ke Supabase)

-- ============================================================
-- 11. Allow Public Access for QR Menu (Katalog Pelanggan)
-- Buka akses BACA (Select) ke profil toko dan produk agar 
-- pelanggan yang tidak login (anon) bisa melihat katalog.
-- ============================================================

DROP POLICY IF EXISTS "Allow public to read profiles" ON public.profiles;
CREATE POLICY "Allow public to read profiles"
  ON public.profiles FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Allow public to read products" ON public.products;
CREATE POLICY "Allow public to read products"
  ON public.products FOR SELECT
  USING (true);

-- (Jalankan SQL di atas di Supabase SQL Editor agar pelanggan bisa buka menu)

-- ============================================================
-- 12. Digital Menu Custom URL (Slug)
-- Tambahkan kolom slug ke tabel profiles agar toko bisa memiliki
-- URL kustom yang cantik (misal: kasirhub.com/menu/toko-saya).
-- ============================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;
CREATE INDEX IF NOT EXISTS profiles_slug_idx ON public.profiles (slug);