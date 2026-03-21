import * as XLSX from 'xlsx';
import { Contact, Deal, BoardStage } from '@/types';
import { PERIOD_LABELS, PeriodFilter } from '@/features/dashboard/hooks/useDashboardMetrics';

interface ProductRow {
  name: string;
  quantity: number;
  revenue: number;
}

interface ReportMetrics {
  pipelineValue: number;
  wonRevenue: number;
  actualWinRate: number;
  avgSalesCycle: number;
  wonDeals: Deal[];
  lostDeals: Deal[];
  contactsCount: number;
  funnelData: { name: string; count: number }[];
  trendData: { month: string; revenue: number }[];
}

export function exportLeadsXLSX(contacts: Contact[], period: PeriodFilter) {
  const rows = contacts.map(c => ({
    'Nome': c.name,
    'Email': c.email,
    'Telefone': c.phone,
    'Status': c.status,
    'Etapa': c.stage,
    'Origem': c.source || '',
    'LTV': c.totalValue ?? 0,
    'Criado em': new Date(c.createdAt).toLocaleDateString('pt-BR'),
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Leads');
  XLSX.writeFile(wb, `leads-${period}.xlsx`);
}

export function exportPipelineXLSX(deals: Deal[], stages: BoardStage[]) {
  const stageMap = Object.fromEntries(stages.map(s => [s.id, s.label]));
  const rows = deals.map(d => ({
    'Título': d.title,
    'Valor': d.value,
    'Etapa': stageMap[d.status] || d.status,
    'Responsável': d.owner?.name || '',
    'Probabilidade %': d.probability,
    'Status': d.isWon ? 'Ganho' : d.isLost ? 'Perdido' : 'Em aberto',
    'Criado em': new Date(d.createdAt).toLocaleDateString('pt-BR'),
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Pipeline');
  XLSX.writeFile(wb, `pipeline.xlsx`);
}

export function exportReportXLSX(
  metrics: ReportMetrics,
  period: PeriodFilter,
  products: ProductRow[]
) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: KPIs
  const kpiRows = [
    { 'KPI': 'Período', 'Valor': PERIOD_LABELS[period] },
    { 'KPI': 'Pipeline Total', 'Valor': metrics.pipelineValue },
    { 'KPI': 'Receita Fechada', 'Valor': metrics.wonRevenue },
    { 'KPI': 'Win Rate', 'Valor': `${metrics.actualWinRate.toFixed(1)}%` },
    { 'KPI': 'Ciclo Médio (dias)', 'Valor': metrics.avgSalesCycle },
    { 'KPI': 'Deals Ganhos', 'Valor': metrics.wonDeals.length },
    { 'KPI': 'Deals Perdidos', 'Valor': metrics.lostDeals.length },
    { 'KPI': 'Novos Leads', 'Valor': metrics.contactsCount },
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(kpiRows), 'KPIs');

  // Sheet 2: Funil
  const funnelRows = metrics.funnelData.map((f, i) => ({
    'Etapa': f.name,
    'Deals': f.count,
    'Conversão p/ etapa anterior (%)':
      i === 0 ? '-' : metrics.funnelData[i - 1].count > 0
        ? `${Math.round((f.count / metrics.funnelData[i - 1].count) * 100)}%`
        : '0%',
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(funnelRows), 'Funil');

  // Sheet 3: Tendência de Receita
  const trendRows = metrics.trendData.map(t => ({ 'Mês': t.month, 'Receita': t.revenue }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(trendRows), 'Receita por Período');

  // Sheet 4: Produtos (only if exists)
  if (products.length > 0) {
    const productRows = products.map((p, i) => ({
      'Rank': i + 1,
      'Produto': p.name,
      'Qtd. Vendida': p.quantity,
      'Receita Total': p.revenue,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(productRows), 'Produtos');
  }

  XLSX.writeFile(wb, `relatorio-${period}.xlsx`);
}
