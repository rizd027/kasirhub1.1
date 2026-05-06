'use client';

import { useEffect, useState } from 'react';
import { ReportLayout } from '@/features/reports/ReportLayout';
import { db, LocalTransaction } from '@/lib/dexie';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Users, ShoppingBag, CreditCard, Wallet, Percent } from 'lucide-react';

interface CartItemInTx {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface TopProduct {
  name: string;
  qty: number;
  revenue: number;
}

export default function SummaryPage() {
  const [stats, setStats] = useState({
    totalTx: 0,
    totalOmzet: 0,
    totalDiskon: 0,
    tunai: 0,
    tempo: 0,
    avgTx: 0,
  });
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [maxQty, setMaxQty] = useState(0);

  useEffect(() => {
    db.transactions.toArray().then(txs => {
      const totalOmzet = txs.reduce((s, t) => s + t.total_amount, 0);
      const totalDiskon = txs.reduce((s, t) => s + (t.discount_total || 0), 0);
      const tunai = txs.filter(t => t.payment_method === 'cash').reduce((s, t) => s + t.total_amount, 0);
      const tempo = txs.filter(t => t.payment_method === 'tempo').reduce((s, t) => s + t.total_amount, 0);
      const avgTx = txs.length > 0 ? totalOmzet / txs.length : 0;

      setStats({ totalTx: txs.length, totalOmzet, totalDiskon, tunai, tempo, avgTx });

      // Top products
      const productMap = new Map<string, TopProduct>();
      txs.forEach(tx => {
        tx.items.forEach((item: CartItemInTx) => {
          const key = item.name;
          if (!productMap.has(key)) productMap.set(key, { name: item.name, qty: 0, revenue: 0 });
          const p = productMap.get(key)!;
          p.qty += item.quantity;
          p.revenue += item.price * item.quantity;
        });
      });
      
      const sorted = Array.from(productMap.values()).sort((a, b) => b.qty - a.qty).slice(0, 5);
      setTopProducts(sorted);
      if (sorted.length > 0) {
        setMaxQty(sorted[0].qty);
      }
    });
  }, []);

  const metrics = [
    { label: 'Total Omzet', value: `Rp ${stats.totalOmzet.toLocaleString('id-ID')}`, icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Total Transaksi', value: stats.totalTx.toString(), icon: ShoppingBag, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Rata-rata Transaksi', value: `Rp ${stats.avgTx.toLocaleString('id-ID')}`, icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Total Diskon', value: `Rp ${stats.totalDiskon.toLocaleString('id-ID')}`, icon: Percent, color: 'text-red-600', bg: 'bg-red-50' },
  ];

  return (
    <ReportLayout title="Summary">
      <div className="p-4 flex flex-col gap-6">
        {/* Metric Cards */}
        <div className="grid grid-cols-2 gap-4">
          {metrics.map((m) => (
            <Card key={m.label} className="border-none shadow-sm overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`p-2 rounded-lg ${m.bg}`}>
                    <m.icon className={`h-4 w-4 ${m.color}`} />
                  </div>
                  <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{m.label}</span>
                </div>
                <div className="text-sm font-bold truncate">{m.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Payment Methods */}
        <Card className="border-none shadow-sm">
          <CardContent className="p-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
              <CreditCard className="h-4 w-4" /> Metode Pembayaran
            </h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="flex items-center gap-2 font-medium"><Wallet className="h-3 w-3 text-green-600" /> Tunai</span>
                  <span className="font-bold">Rp {stats.tunai.toLocaleString('id-ID')}</span>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-green-500 transition-all duration-1000" 
                    style={{ width: `${stats.totalOmzet > 0 ? (stats.tunai / stats.totalOmzet) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="flex items-center gap-2 font-medium"><CreditCard className="h-3 w-3 text-amber-600" /> Tempo</span>
                  <span className="font-bold">Rp {stats.tempo.toLocaleString('id-ID')}</span>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-amber-500 transition-all duration-1000" 
                    style={{ width: `${stats.totalOmzet > 0 ? (stats.tempo / stats.totalOmzet) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Top Products */}
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 px-1">Produk Terlaris</h2>
          <div className="space-y-3">
            {topProducts.length === 0 ? (
              <div className="text-center text-muted-foreground py-10 text-sm border rounded-xl bg-muted/20">Belum ada data</div>
            ) : (
              topProducts.map((p, i) => (
                <Card key={p.name} className="border-none shadow-sm overflow-hidden">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                          {i + 1}
                        </span>
                        <div>
                          <div className="text-sm font-bold truncate max-w-[150px]">{p.name}</div>
                          <div className="text-[10px] text-muted-foreground">Rp {p.revenue.toLocaleString('id-ID')}</div>
                        </div>
                      </div>
                      <Badge variant="secondary" className="text-[10px] font-bold h-6">
                        {p.qty} terjual
                      </Badge>
                    </div>
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary transition-all duration-1000" 
                        style={{ width: `${(p.qty / maxQty) * 100}%` }}
                      ></div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
    </ReportLayout>
  );
}
