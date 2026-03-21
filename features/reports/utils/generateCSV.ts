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

function downloadCSV(rows: string[][], filename: string) {
  const csv = rows.map(r =>
    r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')
  ).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export function exportLeadsCSV(contacts: Contact[], period: PeriodFilter) {
  const header = ['Nome', 'Email', 'Telefone', 'Status', 'Etapa', 'Origem', 'LTV', 'Criado em'];
  const rows = contacts.map(c => [
    c.name,
    c.email,
    c.phone,
    c.status,
    c.stage,
    c.source || '',
    String(c.totalValue ?? 0),
    new Date(c.createdAt).toLocaleDateString('pt-BR'),
  ]);
  downloadCSV([header, ...rows], `leads-${period}.csv`);
}

export function exportPipelineCSV(deals: Deal[], stages: BoardStage[]) {
  const stageMap = Object.fromEntries(stages.map(s => [s.id, s.label]));
  const header = ['Título', 'Valor', 'Etapa', 'Responsável', 'Probabilidade %', 'Status', 'Criado em'];
  const rows = deals.map(d => [
    d.title,
    String(d.value),
    stageMap[d.status] || d.status,
    d.owner?.name || '',
    String(d.probability),
    d.isWon ? 'Ganho' : d.isLost ? 'Perdido' : 'Em aberto',
    new Date(d.createdAt).toLocaleDateString('pt-BR'),
  ]);
  downloadCSV([header, ...rows], `pipeline.csv`);
}

export function exportReportCSV(
  metrics: ReportMetrics,
  period: PeriodFilter,
  products: ProductRow[]
) {
  const label = PERIOD_LABELS[period];
  const rows: string[][] = [];

  rows.push(['RELATÓRIO DE PERFORMANCE', label]);
  rows.push([]);
  rows.push(['KPI', 'Valor']);
  rows.push(['Pipeline Total', String(metrics.pipelineValue)]);
  rows.push(['Receita Fechada', String(metrics.wonRevenue)]);
  rows.push(['Win Rate', `${metrics.actualWinRate.toFixed(1)}%`]);
  rows.push(['Ciclo Médio', `${metrics.avgSalesCycle} dias`]);
  rows.push(['Deals Ganhos', String(metrics.wonDeals.length)]);
  rows.push(['Deals Perdidos', String(metrics.lostDeals.length)]);
  rows.push(['Novos Leads', String(metrics.contactsCount)]);
  rows.push([]);
  rows.push(['FUNIL DE CONVERSÃO']);
  rows.push(['Etapa', 'Deals']);
  metrics.funnelData.forEach(f => rows.push([f.name, String(f.count)]));
  rows.push([]);
  rows.push(['TENDÊNCIA DE RECEITA (últimos 6 meses)']);
  rows.push(['Mês', 'Receita']);
  metrics.trendData.forEach(t => rows.push([t.month, String(t.revenue)]));

  if (products.length > 0) {
    rows.push([]);
    rows.push(['PRODUTOS MAIS VENDIDOS']);
    rows.push(['Produto', 'Qtd. Vendida', 'Receita Total']);
    products.forEach(p => rows.push([p.name, String(p.quantity), String(p.revenue)]));
  }

  downloadCSV(rows, `relatorio-${period}.csv`);
}
