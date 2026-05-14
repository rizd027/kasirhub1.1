-- Fix: RLS Policies & Column Migration for Digital Menu
-- JALANKAN SKRIP INI DI SQL EDITOR SUPABASE

-- 1. Pastikan tabel dan kolom-kolom utama ada
CREATE TABLE IF NOT EXISTS public.customer_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid()
);

ALTER TABLE public.customer_orders ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.customer_orders ADD COLUMN IF NOT EXISTS buyer_id UUID;
ALTER TABLE public.customer_orders ADD COLUMN IF NOT EXISTS table_number TEXT;
ALTER TABLE public.customer_orders ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE public.customer_orders ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]';
ALTER TABLE public.customer_orders ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

-- 2. Profiles: Izinkan siapa saja (publik) membaca info dasar toko
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
CREATE POLICY "Public profiles are viewable by everyone" ON profiles
  FOR SELECT USING (true);

-- 3. Products: Izinkan siapa saja membaca produk yang aktif
DROP POLICY IF EXISTS "Public products are viewable by everyone" ON products;
CREATE POLICY "Public products are viewable by everyone" ON products
  FOR SELECT USING (deleted_at IS NULL);

-- 4. Customer Orders: Izinkan pelanggan (anonim) mengirim pesanan
DROP POLICY IF EXISTS "Customers can insert their own orders" ON customer_orders;
CREATE POLICY "Customers can insert their own orders" ON customer_orders
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- 5. Customer Orders: Izinkan pembeli melihat pesanan mereka sendiri
DROP POLICY IF EXISTS "Buyers can view their own orders" ON customer_orders;
CREATE POLICY "Buyers can view their own orders" ON customer_orders
  FOR SELECT TO authenticated
  USING (buyer_id = auth.uid() OR auth.uid() = user_id);

-- 6. Aktifkan Realtime untuk Pesanan (Agar Inbox Kasir otomatis update)
ALTER TABLE public.customer_orders REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'customer_orders') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.customer_orders;
  END IF;
END $$;

-- Reload Schema Cache
NOTIFY pgrst, 'reload schema';
