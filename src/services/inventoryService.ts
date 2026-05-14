import { db } from '@/db/dexie';

export interface InventoryPrediction {
  daysRemaining: number;
  burnRate: number;
  status: 'safe' | 'warning' | 'critical';
}

export const inventoryService = {
  async getPredictions(daysToAnalyze: number = 7): Promise<{
    products: Record<string, InventoryPrediction>;
    ingredients: Record<string, InventoryPrediction>;
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysToAnalyze);
    const startDateStr = startDate.toISOString();

    const recentTransactions = await db.transactions
      .where('created_at')
      .above(startDateStr)
      .toArray();
    
    const transactionIds = recentTransactions.map(t => t.id);
    const items = await db.transaction_items
      .where('transaction_id')
      .anyOf(transactionIds)
      .toArray();

    const productUsage: Record<string, number> = {};
    items.forEach(item => {
      productUsage[item.product_id] = (productUsage[item.product_id] || 0) + item.quantity;
    });

    const [products, ingredients, productIngs] = await Promise.all([
      db.products.toArray(),
      db.ingredients.toArray(),
      db.product_ingredients.toArray()
    ]);

    const productPredictions: Record<string, InventoryPrediction> = {};
    const ingredientPredictions: Record<string, InventoryPrediction> = {};

    products.forEach(p => {
      const usage = productUsage[p.id] || 0;
      const burnRate = usage / daysToAnalyze;
      const currentStock = (p.stock_store || 0) + (p.stock_warehouse || 0);
      
      let daysRemaining = burnRate > 0 ? currentStock / burnRate : 999;
      if (currentStock <= 0) daysRemaining = 0;

      productPredictions[p.id] = {
        daysRemaining,
        burnRate,
        status: daysRemaining < 3 ? 'critical' : daysRemaining < 7 ? 'warning' : 'safe'
      };
    });

    const ingredientDailyBurn: Record<string, number> = {};
    
    for (const productId in productUsage) {
      const dailyProductBurn = productUsage[productId] / daysToAnalyze;
      const recipe = productIngs.filter(pi => pi.product_id === productId);
      
      recipe.forEach(ri => {
        ingredientDailyBurn[ri.ingredient_id] = (ingredientDailyBurn[ri.ingredient_id] || 0) + (ri.quantity * dailyProductBurn);
      });
    }

    ingredients.forEach(ing => {
      const burnRate = ingredientDailyBurn[ing.id] || 0;
      const currentStock = ing.stock_current || 0;
      
      let daysRemaining = burnRate > 0 ? currentStock / burnRate : 999;
      if (currentStock <= 0) daysRemaining = 0;

      ingredientPredictions[ing.id] = {
        daysRemaining,
        burnRate,
        status: daysRemaining < 3 ? 'critical' : daysRemaining < 7 ? 'warning' : 'safe'
      };
    });

    return { products: productPredictions, ingredients: ingredientPredictions };
  }
};
