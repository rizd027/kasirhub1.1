-- ==================================================================================
-- SCRIPT PEMBERSIHAN TOTAL (FORCED CLEANUP WITH CASCADE)
-- ==================================================================================

-- 1. Hapus Triggers & Functions
DROP TRIGGER IF EXISTS on_transaction_item_added ON public.transaction_items CASCADE;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users CASCADE;
DROP FUNCTION IF EXISTS public.handle_transaction_stock() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- 2. Hapus Tabel dengan CASCADE
-- Menambahkan CASCADE akan memutus hubungan Foreign Key secara paksa saat penghapusan
DROP TABLE IF EXISTS public.attendance CASCADE;
DROP TABLE IF EXISTS public.employees CASCADE; -- Tabel ini yang menyebabkan error tadi
DROP TABLE IF EXISTS public.stock_logs CASCADE;
DROP TABLE IF EXISTS public.receivables CASCADE;
DROP TABLE IF EXISTS public.transaction_items CASCADE;
DROP TABLE IF EXISTS public.transactions CASCADE;
DROP TABLE IF EXISTS public.products CASCADE;
DROP TABLE IF EXISTS public.categories CASCADE;
DROP TABLE IF EXISTS public.settings CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- 3. Hapus Tipe Data Custom
DROP TYPE IF EXISTS public.user_role CASCADE;

-- ==================================================================================
-- DATABASE BERSIH TOTAL.
-- Relasi transactions_employee_id_fkey telah ikut terhapus secara otomatis.
-- ==================================================================================