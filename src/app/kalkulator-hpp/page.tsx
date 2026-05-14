'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ChevronLeft, 
  Trash2, 
  Search,
  ArrowUpRight,
  Zap,
  Plus,
  Package,
  Calculator
} from 'lucide-react';
import { db } from '@/db/dexie';
import { addToSyncQueue } from '@/services/sync/syncManager';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { 
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { SettingsLayout } from '@/features/settings/SettingsLayout';
import { MasterDataTabs } from '@/components/master-data/MasterDataTabs';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger, 
  DropdownMenuSeparator, 
  DropdownMenuLabel, 
  DropdownMenuGroup 
} from '@/components/ui/dropdown-menu';
import { MoreVertical, History, Pencil, FileText } from 'lucide-react';

export default function HppListPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');

  const history = useLiveQuery(
    () => db.hpp_batches.toArray(),
    []
  );

  const filteredHistory = history?.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const deleteHpp = async (id: string) => {
    if (confirm('Yakin ingin menghapus riwayat perhitungan HPP ini?')) {
      try {
        const deleted_at = new Date().toISOString();
        await db.hpp_batches.update(id, { 
          deleted_at, 
          sync_status: 'pending' 
        });
        await addToSyncQueue('hpp_batches', 'update', id, { deleted_at });
        toast.success('Riwayat berhasil dihapus');
      } catch (err) {
        toast.error('Gagal menghapus riwayat');
      }
    }
  };

  return (
    <SettingsLayout
      title="History Analisis"
      subtitle="Kalkulator HPP"
      backUrl="/produk"
      rightAction={
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon" className="size-9 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground">
                <MoreVertical className="h-4 w-4" />
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-44 rounded-lg p-2 shadow-xl border-slate-100">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2 py-1.5">Aksi Massal</DropdownMenuLabel>
              <DropdownMenuSeparator className="my-1 bg-slate-50" />
              <DropdownMenuItem onClick={() => router.push('/kalkulator-hpp/kalkulasi')} className="flex items-start py-2.5 px-2 rounded-lg cursor-pointer focus:bg-indigo-50 focus:text-indigo-600">
                <Plus className="h-4 w-4 mr-2 mt-0.5 shrink-0 text-slate-400" />
                <span className="text-xs font-semibold whitespace-normal leading-tight">Mulai Analisis Baru</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      }
    >
      <div className="flex flex-col">
        {/* Sub-Navigation Tabs */}
        <MasterDataTabs />

        {/* Search and Add - Snippet Style */}
        <div className="px-4 py-4 flex gap-4 items-center border-b border-slate-100 bg-white/50 backdrop-blur-sm sticky top-[64px] z-20">
          <div className="relative flex-1 group">
            <Search className="absolute left-0 top-1/2 -translate-y-1/2 size-4 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
            <Input
              placeholder="Cari nama analisis..."
              className="pl-7 h-10 bg-transparent border-0 border-b-2 border-slate-100 rounded-none shadow-none text-sm focus-visible:ring-0 focus-visible:border-indigo-500 placeholder:text-slate-300 font-medium w-full uppercase transition-all"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          <Button
            className="h-10 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest rounded-lg shadow-lg shadow-indigo-100 gap-2 text-[10px] shrink-0 transition-all active:scale-95"
            onClick={() => router.push('/kalkulator-hpp/kalkulasi')}
          >
            <Plus className="size-4" />
            <span className="hidden sm:inline">Analisis Baru</span>
          </Button>
        </div>

        {/* HPP List - Snippet Row Style */}
        <div className="flex flex-col border-t border-slate-100">
          {filteredHistory?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 px-6 text-center">
              <div className="size-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                <Zap className="h-10 w-10 text-slate-200" />
              </div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-[0.3em] mb-2">Data Kosong</p>
              <p className="text-sm font-bold text-slate-300 max-w-xs mb-8">
                Anda belum memiliki riwayat analisis HPP. Mulai hitung sekarang untuk memantau profitabilitas bisnis Anda.
              </p>
              <Button 
                variant="outline" 
                className="rounded-lg border-slate-200 text-indigo-600 font-black uppercase tracking-widest text-[10px] px-8 h-11 hover:bg-indigo-50 hover:border-indigo-200 transition-all" 
                onClick={() => router.push('/kalkulator-hpp/kalkulasi')}
              >
                Mulai Analisis
              </Button>
            </div>
          ) : (
            filteredHistory?.map((item) => (
              <div 
                key={item.id} 
                className="group relative flex items-center gap-4 p-3 hover:bg-muted/30 border-b border-slate-100 transition-all cursor-pointer"
                onClick={() => router.push(`/kalkulator-hpp/kalkulasi?id=${item.id}`)}
              >
                {/* Thumbnail Icon */}
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-muted/30 flex items-center justify-center">
                  <Calculator className="h-5 w-5 text-muted-foreground/30" />
                  <div className={cn(
                    "absolute top-1 right-1 size-2 rounded-full border-2 border-white bg-emerald-500",
                    item.sync_status === 'pending' && "bg-amber-500 animate-pulse"
                  )} />
                </div>

                {/* HPP Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-[14px] font-bold text-gray-900 leading-tight truncate flex items-center gap-2 group-hover:text-indigo-600 transition-colors">
                    {item.name}
                  </h3>
                  
                  <div className="text-[12px] font-bold text-indigo-600 mb-1">
                    Rp {item.raw_material_cost.toLocaleString('id-ID')}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="inline-flex items-center gap-1 px-1 py-0.5 rounded bg-muted text-[8px] font-bold text-muted-foreground font-mono">
                      {format(new Date(item.created_at), 'ddMMyy', { locale: localeID }).toUpperCase()}
                    </span>
                    <Badge variant="outline" className="text-[8px] font-black px-1 py-0 uppercase tracking-wider h-3.5 bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                      HPP Analysis
                    </Badge>
                    <div className="flex items-center gap-2 text-[9px] font-bold text-gray-400">
                      <span className="flex items-center gap-1">
                        <Package className="h-2.5 w-2.5" />
                        {item.derived_products.length} Varian
                      </span>
                    </div>
                  </div>
                </div>

                {/* Dropdown Actions */}
                <div className="shrink-0" onClick={e => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-gray-300 hover:text-indigo-600 outline-none">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      }
                    />
                    <DropdownMenuContent align="end" className="w-44 rounded-lg p-2 shadow-xl border-slate-100">
                      <DropdownMenuItem onClick={() => router.push(`/kalkulator-hpp/kalkulasi?id=${item.id}`)} className="flex items-start py-2.5 px-2 rounded-lg cursor-pointer focus:bg-indigo-50 focus:text-indigo-600">
                        <Pencil className="h-4 w-4 mr-2 mt-0.5 shrink-0 text-slate-400" />
                        <span className="text-xs font-semibold whitespace-normal leading-tight">Edit Analisis</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="my-1 bg-slate-50" />
                      <DropdownMenuItem 
                        onClick={() => deleteHpp(item.id)} 
                        className="flex items-start py-2.5 px-2 rounded-lg text-red-600 focus:text-red-600 focus:bg-red-50 cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4 mr-2 mt-0.5 shrink-0" />
                        <span className="text-xs font-semibold whitespace-normal leading-tight">Hapus Riwayat</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

    </SettingsLayout>
  );
}
