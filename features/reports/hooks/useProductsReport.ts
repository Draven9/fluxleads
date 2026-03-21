import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { Deal } from '@/types';

export interface ProductStat {
  name: string;
  quantity: number;
  revenue: number;
}

function aggregateProducts(items: { name: string; quantity: number; price: number }[]): ProductStat[] {
  const map = new Map<string, ProductStat>();
  for (const item of items) {
    const key = item.name;
    const existing = map.get(key);
    if (existing) {
      existing.quantity += item.quantity;
      existing.revenue += item.quantity * item.price;
    } else {
      map.set(key, { name: item.name, quantity: item.quantity, revenue: item.quantity * item.price });
    }
  }
  return Array.from(map.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);
}

export function useProductsReport(deals: Deal[]) {
  const dealIds = deals.map(d => d.id);

  return useQuery({
    queryKey: ['deal_items_report', dealIds],
    queryFn: async () => {
      if (!dealIds.length) return [];
      const supabase = createClient();
      const { data, error } = await supabase
        .from('deal_items')
        .select('name, quantity, price')
        .in('deal_id', dealIds);
      if (error) throw error;
      return aggregateProducts(data || []);
    },
    enabled: dealIds.length > 0,
    staleTime: 60_000,
  });
}
