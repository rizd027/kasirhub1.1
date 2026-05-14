import { db } from '@/db/dexie';

export interface BundleSuggestion {
  productIds: string[];
  productNames: string[];
  count: number;
  confidence: number;
}

export const marketBasketService = {
  async getSuggestions(minOccurrences: number = 2): Promise<BundleSuggestion[]> {
    const transactions = await db.transactions.toArray();
    const products = await db.products.toArray();
    const productMap = new Record<string, string>(products.map(p => [p.id, p.name]));
    
    const pairCounts: Record<string, number> = {};
    const productCounts: Record<string, number> = {};

    transactions.forEach(t => {
      const itemIds = Array.from(new Set(t.items.map(i => i.product_id))).sort();
      
      itemIds.forEach(id => {
        productCounts[id] = (productCounts[id] || 0) + 1;
      });

      for (let i = 0; i < itemIds.length; i++) {
        for (let j = i + 1; j < itemIds.length; j++) {
          const pair = `${itemIds[i]}|${itemIds[j]}`;
          pairCounts[pair] = (pairCounts[pair] || 0) + 1;
        }
      }
    });

    const suggestions: BundleSuggestion[] = Object.entries(pairCounts)
      .filter(([_, count]) => count >= minOccurrences)
      .map(([pair, count]) => {
        const [idA, idB] = pair.split('|');
        const countA = productCounts[idA] || 1;
        const countB = productCounts[idB] || 1;
        
        const confidence = Math.max(count / countA, count / countB) * 100;

        return {
          productIds: [idA, idB],
          productNames: [productMap[idA] || 'Unknown', productMap[idB] || 'Unknown'],
          count,
          confidence
        };
      })
      .sort((a, b) => b.confidence - a.confidence);

    return suggestions;
  }
};

class Record<K extends string | number | symbol, V> {
  [key: string]: V;
  constructor(entries: [K, V][]) {
    entries.forEach(([k, v]) => {
      this[k as string] = v;
    });
  }
}
