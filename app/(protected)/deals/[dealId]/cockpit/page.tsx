import DealCockpitClient from '@/features/deals/cockpit/DealCockpitClient';

/**
 * Cockpit (real) - rota canônica fora de /labs.
 * URL: /deals/[dealId]/cockpit
 */
export default async function DealCockpitPage({
  params,
}: {
  params: Promise<{ dealId: string }>;
}) {
  const { dealId } = await params;
  return <DealCockpitClient dealId={dealId} />;
}
