'use client';

import { useEffect, useState } from 'react';
import { ReportLayout } from '@/features/reports/ReportLayout';
import { db, LocalTransaction } from '@/lib/dexie';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';

export default function LabaPenjualanPage() {
  const [transactions, setTransactions] = useState<LocalTransaction[]>([]);
  const [totalOmzet, setTotalOmzet] = useState(0);
  const [totalDiskon, setTotalDiskon] = useState(0);

  useEffect(() => {
    db.transactions.orderBy('created_at').reverse().toArray().then(txs => {
      setTransactions(txs.slice(0, 50));
      setTotalOmzet(txs.reduce((s, t) => s + t.total_amount, 0));
      setTotalDiskon(txs.reduce((s, t) => s + (t.discount_total || 0), 0));
    });
  }, []);

  return (
    <ReportLayout title="Laba Penjualan">
      <div className="p-4 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-3">
              <div className="text-xs text-muted-foreground">Total Omzet</div>
              <div className="text-base font-bold text-green-600">Rp {totalOmzet.toLocaleString('id-ID')}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="text-xs text-muted-foreground">Total Diskon</div>
              <div className="text-base font-bold text-red-500">Rp {totalDiskon.toLocaleString('id-ID')}</div>
            </CardContent>
          </Card>
        </div>

        <div className="border rounded-md overflow-hidden">
          <div className="grid grid-cols-3 px-4 py-2 bg-muted text-xs font-semibold text-muted-foreground">
            <span>Tanggal</span>
            <span className="text-right">Omzet</span>
            <span className="text-right">Diskon</span>
          </div>
          {transactions.length === 0 ? (
            <div className="text-center text-muted-foreground py-12 text-sm">Belum ada data</div>
          ) : (
            transactions.map(tx => (
              <div key={tx.id} className="grid grid-cols-3 px-4 py-3 border-t text-xs items-center">
                <span className="text-muted-foreground">{format(new Date(tx.created_at), 'dd/MM/yy HH:mm')}</span>
                <span className="text-right font-medium text-green-700">Rp {tx.total_amount.toLocaleString('id-ID')}</span>
                <span className="text-right text-red-500">{tx.discount_total > 0 ? `Rp ${tx.discount_total.toLocaleString('id-ID')}` : '-'}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </ReportLayout>
  );
}
