'use client';

import { SettingsLayout } from '@/features/settings/SettingsLayout';
import { ChevronRight } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

const faqs = [
  {
    q: 'Bagaimana cara menambah produk?',
    a: 'Saat ini produk dapat ditambahkan melalui dashboard Supabase atau melalui fitur Import di menu Penyimpanan Data.',
  },
  {
    q: 'Apakah aplikasi bisa digunakan tanpa internet?',
    a: 'Ya. KasirHub adalah aplikasi offline-first. Semua transaksi disimpan di perangkat dan otomatis disinkronkan saat internet tersedia kembali.',
  },
  {
    q: 'Apa itu mode Tempo?',
    a: 'Mode Tempo adalah transaksi piutang/kredit. Pelanggan belum membayar saat itu, dan transaksi dicatat dengan status "unpaid".',
  },
  {
    q: 'Bagaimana cara mencetak struk?',
    a: 'Tekan tombol Bayar lalu pilih metode pembayaran. Setelah transaksi berhasil, opsi cetak struk akan muncul.',
  },
  {
    q: 'Apa itu stok toko vs stok gudang?',
    a: 'Stok toko adalah barang yang siap dijual di kasir. Stok gudang adalah cadangan. Saat transaksi, stok toko otomatis berkurang.',
  },
  {
    q: 'Bagaimana cara backup data?',
    a: 'Buka Setting → Penyimpanan Data → Export Backup (JSON). File backup dapat diimpor kembali di perangkat lain.',
  },
  {
    q: 'Bagaimana formula diskon bertingkat?',
    a: 'Rumus: ((Harga × (1 - Disc1%)) × (1 - Disc2%)) - Potongan Nominal.',
  },
];

export default function BantuanPage() {
  return (
    <SettingsLayout title="Bantuan">
      <div className="p-4 flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">Panduan penggunaan aplikasi KasirHub POS.</p>

        <div className="border rounded-md overflow-hidden">
          {faqs.map((faq, i) => (
            <details key={i} className="group border-b last:border-b-0">
              <summary className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted list-none">
                <span className="text-sm font-medium">{faq.q}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 group-open:rotate-90 transition-transform" />
              </summary>
              <div className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed">
                {faq.a}
              </div>
            </details>
          ))}
        </div>

        <Separator />

        <div className="p-4 bg-muted rounded-md flex flex-col gap-1">
          <div className="text-sm font-semibold">KasirHub POS</div>
          <div className="text-xs text-muted-foreground">Versi 1.0.0</div>
          <div className="text-xs text-muted-foreground mt-1">
            Dibangun dengan Next.js 16, Supabase, Dexie.js, dan Shadcn UI.
          </div>
        </div>
      </div>
    </SettingsLayout>
  );
}
