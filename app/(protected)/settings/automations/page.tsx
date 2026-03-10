import dynamic from 'next/dynamic';
import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Automações | Flux Leads CRM',
};

const SettingsPage = dynamic(
    () => import('@/features/settings/SettingsPage'),
    { ssr: false }
);

export default function AutomationsPageRoute() {
    return <SettingsPage tab="automations" />;
}
