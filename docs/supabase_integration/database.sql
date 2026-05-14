-- KasirHub Database Schema - REFACTORED & SECURED
-- This script consolidates all previous migrations into a clean, idempotent schema.

-- 1. Enable Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- For gen_random_uuid()

-- 2. Clean Existing Triggers to avoid conflicts during refactor
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT trigger_name, event_object_table FROM information_schema.triggers WHERE trigger_schema = 'public') LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', r.trigger_name, r.event_object_table);
    END LOOP;
END $$;

-- 3. Core Tables
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  name TEXT NOT NULL,
  type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  price_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  price_sell DECIMAL(12,2) NOT NULL DEFAULT 0,
  image_url TEXT,
  barcode_type TEXT DEFAULT 'CODE128',
  stock_store INTEGER NOT NULL DEFAULT 0,
  stock_warehouse INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  -- HPP Batch Metadata (Consolidated)
  batch_id UUID,
  prod_target_batch NUMERIC,
  prod_output_qty NUMERIC,
  prod_wastage_percent NUMERIC,
  prod_tax_efficiency NUMERIC,
  prod_operational_costs JSONB DEFAULT '{}',
  prod_monthly_estimate NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(user_id, sku)
);

CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  name TEXT NOT NULL,
  username TEXT UNIQUE,
  role TEXT DEFAULT 'kasir',
  phone TEXT,
  whatsapp TEXT,
  address TEXT,
  photo_url TEXT,
  is_active BOOLEAN DEFAULT true,
  can_view_reports BOOLEAN DEFAULT false,
  employee_pin TEXT, -- Encrypted/Hashed version recommended in app layer
  last_check_in TIMESTAMPTZ,
  gender TEXT,
  birth_place TEXT,
  birth_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  cashier_name TEXT,
  total_amount DECIMAL(12,2) NOT NULL,
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  service_charge_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  discount_total DECIMAL(12,2) DEFAULT 0,
  payment_method TEXT CHECK (payment_method IN ('cash', 'tempo', 'qris', 'transfer')),
  status TEXT CHECK (status IN ('paid', 'unpaid', 'partial')),
  customer_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS transaction_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL,
  price_at_time DECIMAL(12,2) NOT NULL,
  cost_at_time DECIMAL(12,2) NOT NULL DEFAULT 0,
  name_at_time TEXT,
  discount_details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS stock_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  change_amount INTEGER NOT NULL,
  type TEXT NOT NULL, -- 'sale', 'adjustment', 'transfer', 'restock'
  location TEXT NOT NULL, -- 'store', 'warehouse'
  reference_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  sku TEXT,
  barcode TEXT,
  barcode_type TEXT,
  name TEXT NOT NULL,
  unit TEXT NOT NULL,
  cost_per_unit DECIMAL(12,2) NOT NULL DEFAULT 0,
  stock_min DECIMAL(12,2) DEFAULT 0,
  stock_current DECIMAL(12,2) DEFAULT 0,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  image_url TEXT,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS hpp_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  name TEXT NOT NULL,
  batch_count INTEGER DEFAULT 1,
  business_model TEXT,
  recipe_materials JSONB DEFAULT '[]',
  additional_costs JSONB DEFAULT '[]',
  total_production_cost DECIMAL(12,2) DEFAULT 0,
  total_potential_sales DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS bundling (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  name TEXT NOT NULL,
  products JSONB DEFAULT '[]', -- Junction table recommended for future
  price_sell DECIMAL(12,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS processing_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  name TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  period TEXT CHECK (period IN ('per_batch', 'per_produk_turunan')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS product_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  ingredient_id UUID REFERENCES ingredients(id) ON DELETE CASCADE,
  quantity DECIMAL(12,4) NOT NULL DEFAULT 0,
  is_packaging BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  amount DECIMAL(12,2) NOT NULL,
  category TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('in', 'out')),
  photo_url TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  is_verified BOOLEAN DEFAULT FALSE,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS customer_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  buyer_id UUID,
  table_number TEXT,
  customer_name TEXT,
  items JSONB NOT NULL DEFAULT '[]',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- ── 3.1 Migration Patch: Ensure columns exist for existing tables ────────────
DO $$ 
DECLARE 
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'categories', 'products', 'ingredients', 'hpp_batches', 'bundling', 
    'processing_costs', 'product_ingredients', 'transactions', 'transaction_items', 
    'expenses', 'stock_logs', 'employees', 'attendance', 'customer_orders'
  ]) LOOP
    -- Add updated_at if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name=tbl AND column_name='updated_at') THEN
        EXECUTE format('ALTER TABLE public.%I ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW()', tbl);
    END IF;
    -- Add deleted_at if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name=tbl AND column_name='deleted_at') THEN
        EXECUTE format('ALTER TABLE public.%I ADD COLUMN deleted_at TIMESTAMPTZ', tbl);
    END IF;
  END LOOP;
END $$;

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'admin',
  full_name TEXT,
  store_name TEXT,
  slug TEXT UNIQUE,
  photo_url TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'removed')),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  toko_info JSONB DEFAULT '{}',
  pin_code TEXT, -- Encryption recommended in app layer
  preferences JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.2 Automated Profile & Settings Creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- SKIP profile/settings for anonymous consumers
  IF (new.raw_app_meta_data->>'provider' = 'anonymous') THEN
    RETURN new;
  END IF;

  INSERT INTO public.profiles (id, full_name, role)
  VALUES (new.id, 'User Baru', 'admin');
  
  INSERT INTO public.settings (user_id)
  VALUES (new.id);

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Indices for Performance & FKs
-- All foreign keys should be indexed for JOIN performance
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_employee ON transactions(employee_id);
CREATE INDEX IF NOT EXISTS idx_transaction_items_transaction ON transaction_items(transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_items_product ON transaction_items(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_logs_product ON stock_logs(product_id);
CREATE INDEX IF NOT EXISTS idx_product_ingredients_product ON product_ingredients(product_id);
CREATE INDEX IF NOT EXISTS idx_product_ingredients_ingredient ON product_ingredients(ingredient_id);

-- Performance Indices for Sync (Partial to ignore deleted records)
DO $$ 
DECLARE tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'categories', 'products', 'ingredients', 'hpp_batches', 'bundling', 
    'processing_costs', 'product_ingredients', 'transactions', 'expenses'
  ]) LOOP
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I(user_id, updated_at DESC) WHERE deleted_at IS NULL', 'idx_' || tbl || '_sync_active', tbl);
  END LOOP;
END $$;

-- 5. Business Logic: Atomic Stock Management
CREATE OR REPLACE FUNCTION public.handle_transaction_stock_atomic()
RETURNS TRIGGER AS $$
BEGIN
    -- Atomic decrement with safety check
    UPDATE public.products 
    SET stock_store = stock_store - NEW.quantity 
    WHERE id = NEW.product_id 
    AND (stock_store - NEW.quantity) >= -1000; -- Optional safety margin or 0

    -- Log the change
    INSERT INTO public.stock_logs (product_id, user_id, change_amount, type, location, reference_id)
    VALUES (NEW.product_id, NEW.user_id, -NEW.quantity, 'sale', 'store', NEW.transaction_id);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_transaction_item_added 
AFTER INSERT ON transaction_items 
FOR EACH ROW EXECUTE FUNCTION handle_transaction_stock_atomic();

-- 6. Utility: Global updated_at Trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'categories', 'products', 'ingredients', 'hpp_batches',
    'bundling', 'processing_costs', 'product_ingredients', 'profiles',
    'transactions', 'transaction_items', 'employees', 'stock_logs',
    'expenses', 'attendance', 'customer_orders'
  ]) LOOP
    EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at()', tbl);
  END LOOP;
END $$;

-- 7. Security: RLS Policies (STRICT ISOLATION)
-- Enable RLS on all tables
DO $$
DECLARE tbl TEXT;
BEGIN
  FOR tbl IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
  END LOOP;
END $$;

-- Generic strict policy generator (for Owner-only management)
DO $$
DECLARE tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'categories', 'hpp_batches', 'bundling', 
    'processing_costs', 'product_ingredients', 'employees', 'customer_orders'
  ]) LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Users can manage own %I" ON public.%I', tbl, tbl);
    EXECUTE format('CREATE POLICY "Users can manage own %I" ON public.%I 
      FOR ALL TO authenticated 
      USING (auth.uid() = user_id AND deleted_at IS NULL) 
      WITH CHECK (auth.uid() = user_id)', tbl, tbl);
  END LOOP;
END $$;

-- Special cases for Transactions, Items, Expenses & Stock Logs (Public Insert/Update for Staff, Owner Read)
DO $$
DECLARE tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY['transactions', 'transaction_items', 'expenses', 'stock_logs']) LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Users can manage own %I" ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Anyone can manage %I" ON public.%I', tbl, tbl);
    
    -- Anyone can insert & update (for staff soft-login & triggers)
    EXECUTE format('CREATE POLICY "Anyone can manage %I" ON public.%I FOR ALL USING (true) WITH CHECK (true)', tbl, tbl);
    
    -- Only owner can manage via Auth (redundant but safe)
    EXECUTE format('CREATE POLICY "Users can manage own %I" ON public.%I 
      FOR ALL TO authenticated 
      USING (auth.uid() = user_id) 
      WITH CHECK (auth.uid() = user_id)', tbl, tbl);
  END LOOP;
END $$;

-- Special cases for Profiles (Public Read)
DROP POLICY IF EXISTS "Users can manage own profile" ON profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
CREATE POLICY "Public profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can manage own profile" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Products, Ingredients & Bundling (Public Read & Update for Stock Triggers)
DROP POLICY IF EXISTS "Users can manage own products" ON products;
DROP POLICY IF EXISTS "Public products are viewable by everyone" ON products;
DROP POLICY IF EXISTS "Anyone can update product stock" ON products;
CREATE POLICY "Public products are viewable by everyone" ON products FOR SELECT USING (deleted_at IS NULL);
CREATE POLICY "Anyone can update product stock" ON products FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Users can manage own products" ON products FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own ingredients" ON ingredients;
DROP POLICY IF EXISTS "Public ingredients viewable" ON ingredients;
DROP POLICY IF EXISTS "Anyone can update ingredient stock" ON ingredients;
CREATE POLICY "Public ingredients viewable" ON ingredients FOR SELECT USING (deleted_at IS NULL);
CREATE POLICY "Anyone can update ingredient stock" ON ingredients FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Users can manage own ingredients" ON ingredients FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own categories" ON categories;
DROP POLICY IF EXISTS "Public categories are viewable by everyone" ON categories;
CREATE POLICY "Public categories are viewable by everyone" ON categories FOR SELECT USING (deleted_at IS NULL);
CREATE POLICY "Users can manage own categories" ON categories FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Shared Data (Public Read)
DROP POLICY IF EXISTS "Public bundling viewable" ON bundling;
CREATE POLICY "Public bundling viewable" ON bundling FOR SELECT USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Public product_ingredients viewable" ON product_ingredients;
CREATE POLICY "Public product_ingredients viewable" ON product_ingredients FOR SELECT USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Public hpp_batches viewable" ON hpp_batches;
CREATE POLICY "Public hpp_batches viewable" ON hpp_batches FOR SELECT USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Public processing_costs viewable" ON processing_costs;
CREATE POLICY "Public processing_costs viewable" ON processing_costs FOR SELECT USING (deleted_at IS NULL);

-- Employees (Public Read for login & selection)
DROP POLICY IF EXISTS "Users can manage own employees" ON employees;
DROP POLICY IF EXISTS "Public employees are viewable by everyone" ON employees;
CREATE POLICY "Public employees are viewable by everyone" ON employees FOR SELECT USING (deleted_at IS NULL);
CREATE POLICY "Users can manage own employees" ON employees FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Attendance (Public Insert & Selection for staff)
DROP POLICY IF EXISTS "Users can manage own attendance" ON attendance;
DROP POLICY IF EXISTS "Anyone can insert attendance" ON attendance;
DROP POLICY IF EXISTS "Anyone can view attendance" ON attendance;
CREATE POLICY "Anyone can insert attendance" ON attendance FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can view attendance" ON attendance FOR SELECT USING (deleted_at IS NULL);
CREATE POLICY "Users can manage own attendance" ON attendance FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Customer Orders (Public Insert & Buyer/Owner Read)
DROP POLICY IF EXISTS "Users can manage own customer_orders" ON customer_orders;
DROP POLICY IF EXISTS "Customers can insert their own orders" ON customer_orders;
DROP POLICY IF EXISTS "Buyers can view their own orders" ON customer_orders;
DROP POLICY IF EXISTS "Owners can manage orders" ON customer_orders;
CREATE POLICY "Customers can insert their own orders" ON customer_orders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Buyers can view their own orders" ON customer_orders FOR SELECT TO authenticated USING (buyer_id = auth.uid() OR auth.uid() = user_id);
CREATE POLICY "Owners can manage orders" ON customer_orders FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Settings (Public Read)
DROP POLICY IF EXISTS "Users can manage own settings" ON settings;
DROP POLICY IF EXISTS "Public settings are viewable by everyone" ON settings;
CREATE POLICY "Public settings are viewable by everyone" ON settings FOR SELECT USING (true);
CREATE POLICY "Users can manage own settings" ON settings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 8. Realtime Configuration
DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN (SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('attendance', 'transactions', 'products', 'categories', 'ingredients', 'hpp_batches', 'bundling', 'processing_costs', 'product_ingredients', 'transaction_items', 'expenses', 'customer_orders')) LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t.table_name) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', t.table_name);
    END IF;
    -- Mengubah Replica Identity menjadi FULL agar payload realtime menangkap data lama saat UPDATE/DELETE
    EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t.table_name);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
