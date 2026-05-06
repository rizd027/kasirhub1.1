'use client';

import { useEffect, useState } from 'react';
import { ReportLayout } from '@/features/reports/ReportLayout';
import { db, LocalTransaction } from '@/lib/dexie';
import { Card, CardContent } from '@/components/ui/card';

interface CartItemInTx {
  id: string;
  name: string;
  price: number;
  price_cost?: number;
  quantity: number;
}

export default function LabaBersihPage() {
  const [totalOmzet, setTotalOmzet] = useState(0);
  const [totalModal, setTotalModal] = useState(0);
  const [totalDiskon, setTotalDiskon] = useState(0);

  useEffect(() => {
    Promise.all([
      db.transactions.toArray(),
      db.products.toArray(),
    ]).then(([txs, products]) => {
      const productMap = new Map(products.map(p => [p.id, p]));

      let omzet = 0;
      let modal = 0;
      let diskon = 0;

      txs.forEach(tx => {
        omzet += tx.total_amount;
        diskon += tx.discount_total || 0;
        tx.items.forEach((item: CartItemInTx) => {
          const product = productMap.get(item.id);
          const cost = product?.price_cost || 0;
          modal += cost * item.quantity;
        });
      });

      setTotalOmzet(omzet);
      setTotalModal(modal);
      setTotalDiskon(diskon);
    });
  }, []);

  const labaBersih = totalOmzet - totalModal - totalDiskon;

  const summaryItems = [
    { label: 'Total Omzet', value: totalOmzet, color: 'text-green-600' },
    { label: 'Total Modal (HPP)', value: totalModal, color: 'text-red-500' },
    { label: 'Total Diskon', value: totalDiskon, color: 'text-amber-600' },
  ];

  return (
    <ReportLayout title="Laba Bersih">
      <div className="p-4 flex flex-col gap-4">
        {summaryItems.map(item => (
          <div key={item.label} className="flex items-center justify-between border-b py-3 last:border-b-0">
            <span className="text-sm text-muted-foreground">{item.label}</span>
            <span className={`text-sm font-semibold ${item.color}`}>
              Rp {item.value.toLocaleString('id-ID')}
            </span>
          </div>
        ))}

        <Card className="border-2 border-primary/20 mt-2">
          <CardContent className="p-4 flex items-center justify-between">
            <span className="text-base font-bold">Laba Bersih</span>
            <span className={`text-xl font-bold ${labaBersih >= 0 ? 'text-green-600' : 'text-destructive'}`}>
              Rp {labaBersih.toLocaleString('id-ID')}
            </span>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground text-center">
          Laba Bersih = Omzet − Modal (HPP) − Diskon
        </p>
      </div>
    </ReportLayout>
  );
}
