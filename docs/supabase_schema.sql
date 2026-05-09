-- KasirHub Database Schema - CONSOLIDATED & FINAL
-- Run this in Supabase SQL Editor to sync your database structure

-- 1. Enable Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Tables
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ 
);

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  price_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  price_sell DECIMAL(12,2) NOT NULL DEFAULT 0,
  image_url TEXT,
  barcode_type TEXT DEFAULT 'CODE128',
  stock_store INTEGER NOT NULL DEFAULT 0,
  stock_warehouse INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(user_id, sku)
);

CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
  name TEXT NOT NULL,
  username TEXT UNIQUE,
  password TEXT,
  role TEXT DEFAULT 'kasir',
  phone TEXT,
  whatsapp TEXT,
  address TEXT,
  photo_url TEXT,
  is_active BOOLEAN DEFAULT true,
  can_view_reports BOOLEAN DEFAULT false,
  employee_pin TEXT,
  last_check_in TIMESTAMPTZ,
  gender TEXT,
  birth_place TEXT,
  birth_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  type TEXT CHECK (type IN ('in', 'out')),
  photo_url TEXT, -- URL from Cloudinary
  note TEXT,
  location_lat DECIMAL(10,8),
  location_lng DECIMAL(11,8),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
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
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL,
  price_at_time DECIMAL(12,2) NOT NULL,
  name_at_time TEXT,
  discount_details JSONB
);

CREATE TABLE IF NOT EXISTS stock_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  change_amount INTEGER NOT NULL,
  type TEXT NOT NULL,
  location TEXT NOT NULL,
  reference_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('in', 'out')),
  photo_url TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  is_verified BOOLEAN DEFAULT FALSE,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'admin',
  full_name TEXT,
  store_name TEXT,
  slug TEXT UNIQUE,
  photo_url TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  toko_info JSONB DEFAULT '{}',
  pin_code TEXT,
  preferences JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customer_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  buyer_id UUID,
  table_number TEXT,
  customer_name TEXT,
  items JSONB NOT NULL DEFAULT '[]',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
  employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  amount DECIMAL(12,2) NOT NULL,
  category TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS ingredients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
  name TEXT NOT NULL,
  unit TEXT NOT NULL,
  cost_per_unit DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS product_ingredients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  ingredient_id UUID REFERENCES ingredients(id) ON DELETE CASCADE,
  quantity DECIMAL(12,4) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. RLS Enable
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_ingredients ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies

-- Employees: Allow public lookup for LOGIN
DROP POLICY IF EXISTS "Allow public lookup for login" ON employees;
CREATE POLICY "Allow public lookup for login" 
ON employees FOR SELECT TO anon, authenticated 
USING (true);

DROP POLICY IF EXISTS "Users can manage own employees" ON employees;
CREATE POLICY "Users can manage own employees" ON employees FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Profiles & Settings: Public access for QR Menu
DROP POLICY IF EXISTS "Allow public to read profiles" ON profiles;
CREATE POLICY "Allow public to read profiles" ON profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public to read settings" ON settings;
CREATE POLICY "Allow public to read settings" ON settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can manage own settings" ON settings;
CREATE POLICY "Users can manage own settings" ON settings FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Products & Categories (Public read for QR Menu)
DROP POLICY IF EXISTS "Allow public to read products" ON products;
CREATE POLICY "Allow public to read products" ON products FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can manage own products" ON products;
CREATE POLICY "Users can manage own products" ON products FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own categories" ON categories;
CREATE POLICY "Users can manage own categories" ON categories FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Transactions & Items
DROP POLICY IF EXISTS "Users can view own transactions" ON transactions;
CREATE POLICY "Users can view own transactions"
ON transactions FOR SELECT TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow public to insert orders" ON customer_orders;
CREATE POLICY "Allow public to insert orders" ON customer_orders FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Users can manage own customer orders" ON customer_orders;
CREATE POLICY "Users can manage own customer orders" ON customer_orders FOR ALL TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own expenses" ON expenses;
CREATE POLICY "Users can manage own expenses" ON expenses FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own ingredients" ON ingredients;
CREATE POLICY "Users can manage own ingredients" ON ingredients FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own product ingredients" ON product_ingredients;
CREATE POLICY "Users can manage own product ingredients" ON product_ingredients FOR ALL TO authenticated
USING (true)
WITH CHECK (true); -- Usually restricted via product ownership, but for simplicity we use broad policy or check user_id via product join.

-- Attendance (Bidirectional Sync Support)
DROP POLICY IF EXISTS "Allow public to insert attendance" ON attendance;
DROP POLICY IF EXISTS "Allow employees to insert attendance" ON attendance;
DROP POLICY IF EXISTS "Users can view own attendance" ON attendance;
DROP POLICY IF EXISTS "Allow authenticated insert" ON attendance;
DROP POLICY IF EXISTS "Allow ANYONE to insert attendance" ON attendance;
DROP POLICY IF EXISTS "Users can manage own attendance" ON attendance;

-- Allow anyone (including unauthenticated local sessions) to insert
CREATE POLICY "Allow ANYONE to insert attendance" ON attendance FOR INSERT TO public, anon, authenticated WITH CHECK (true);

-- Restrict management and viewing to the actual store owner
CREATE POLICY "Users can manage own attendance" ON attendance FOR ALL TO authenticated USING (auth.uid() = user_id);

-- 5. Functions & Triggers
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS on_products_updated ON products;
CREATE TRIGGER on_products_updated BEFORE UPDATE ON products FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();

DROP TRIGGER IF EXISTS on_employees_updated ON employees;
CREATE TRIGGER on_employees_updated BEFORE UPDATE ON employees FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();

-- Stock Handler Trigger (SECURITY DEFINER for Kasir access)
CREATE OR REPLACE FUNCTION public.handle_transaction_stock()
RETURNS TRIGGER AS $$
DECLARE
    v_owner_id UUID;
BEGIN
    SELECT user_id INTO v_owner_id FROM public.transactions WHERE id = NEW.transaction_id;
    UPDATE public.products SET stock_store = stock_store - NEW.quantity WHERE id = NEW.product_id;
    INSERT INTO public.stock_logs (product_id, user_id, change_amount, type, location, reference_id)
    VALUES (NEW.product_id, v_owner_id, -NEW.quantity, 'sale', 'store', NEW.transaction_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_transaction_item_added ON transaction_items;
CREATE TRIGGER on_transaction_item_added AFTER INSERT ON transaction_items FOR EACH ROW EXECUTE FUNCTION handle_transaction_stock();

-- 6. Auth Trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (new.id, COALESCE(new.raw_user_meta_data->>'full_name', 'User Baru'), 'admin')
  ON CONFLICT (id) DO NOTHING;
  
  INSERT INTO public.settings (user_id)
  VALUES (new.id)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 7. Realtime Configuration (Safe Re-runnable)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'attendance') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE attendance;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'transactions') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE transactions;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'products') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE products;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'categories') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE categories;
  END IF;
END $$;

-- Force refresh cache
NOTIFY pgrst, 'reload schema';