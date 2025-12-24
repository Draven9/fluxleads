'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

const STORAGE_TOKEN = 'crm_install_token';
const STORAGE_PROJECT = 'crm_install_project';

export default function InstallEntryPage() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem(STORAGE_TOKEN);
    const project = localStorage.getItem(STORAGE_PROJECT);
    if (token && project) {
      router.replace('/install/wizard');
    } else {
      router.replace('/install/start');
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-dark-bg flex items-center justify-center relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute -top-[20%] -right-[10%] w-[50%] h-[50%] bg-primary-500/20 rounded-full blur-[120px]" />
        <div className="absolute top-[40%] -left-[10%] w-[40%] h-[40%] bg-blue-500/20 rounded-full blur-[100px]" />
      </div>
      <Loader2 className="w-6 h-6 text-primary-500 animate-spin relative z-10" />
    </div>
  );
}
