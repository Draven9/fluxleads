"use client";

import dynamic from 'next/dynamic';

const SettingsPage = dynamic(
    () => import('@/features/settings/SettingsPage'),
    { ssr: false }
);

export default function AutomationsPageRoute() {
    return <SettingsPage tab="automations" />;
}
