import type { ComponentType } from 'react';
import {
  Inbox,
  KanbanSquare,
  Users,
  CheckSquare,
  MoreHorizontal,
  LayoutDashboard,
  BarChart3,
  Settings,
  User,
  Zap,
  MessageSquare,
  MessageCircle,
  Briefcase,
  Book,
} from 'lucide-react';
import { RouteName } from '@/lib/prefetch';

export type PrimaryNavId = 'inbox' | 'chat' | 'boards' | 'contacts' | 'more';

export interface NavItem {
  id: string;
  label: string;
  href?: string;
  prefetch?: RouteName;
  icon: ComponentType<{ className?: string; size?: number }>;
}

export interface SecondaryNavItem extends NavItem {
  href: string;
  category: 'operacao' | 'analytics' | 'sistema';
}

// Estes itens aparecem na barra inferior do celular (Bottom Nav)
export const PRIMARY_NAV: NavItem[] = [
  { id: 'inbox', label: 'Inbox', href: '/inbox', prefetch: 'inbox', icon: Inbox },
  { id: 'chat', label: 'Mensagens', href: '/chat', prefetch: 'chat', icon: MessageSquare },
  { id: 'boards', label: 'Boards', href: '/boards', prefetch: 'boards', icon: KanbanSquare },
  { id: 'contacts', label: 'Contatos', href: '/contacts', prefetch: 'contacts', icon: Users },
  { id: 'more', label: 'Mais', icon: MoreHorizontal },
];

// Estes itens compõem a bandeja "Mais" no mobile e complementam o Tablet
export const SECONDARY_NAV: SecondaryNavItem[] = [
  // Analytics
  { id: 'dashboard', label: 'Visão Geral', href: '/dashboard', prefetch: 'dashboard', icon: LayoutDashboard, category: 'analytics' },
  { id: 'reports', label: 'Relatórios', href: '/reports', prefetch: 'reports', icon: BarChart3, category: 'analytics' },
  // Operação
  { id: 'comments', label: 'Engajamento', href: '/comments', prefetch: 'comments', icon: MessageCircle, category: 'operacao' },
  { id: 'companies', label: 'Carteira', href: '/companies', prefetch: 'companies', icon: Briefcase, category: 'operacao' },
  { id: 'automations', label: 'Automações', href: '/automations', prefetch: 'automations', icon: Zap, category: 'operacao' },
  { id: 'activities', label: 'Atividades', href: '/activities', prefetch: 'activities', icon: CheckSquare, category: 'operacao' },
  // Sistema
  { id: 'manual', label: 'Manual', href: '/manual', prefetch: 'manual', icon: Book, category: 'sistema' },
  { id: 'settings', label: 'Configurações', href: '/settings', prefetch: 'settings', icon: Settings, category: 'sistema' },
  { id: 'profile', label: 'Perfil', href: '/profile', icon: User, category: 'sistema' },
];

/** Lista completa exportada para o layout Desktop unificar as configurações */
export const DESKTOP_NAV: Omit<NavItem, 'id'>[] = [
    { label: 'Inbox', href: '/inbox', prefetch: 'inbox', icon: Inbox },
    { label: 'Mensagens', href: '/chat', prefetch: 'chat', icon: MessageSquare },
    { label: 'Engajamento', href: '/comments', prefetch: 'comments', icon: MessageCircle },
    { label: 'Visão Geral', href: '/dashboard', prefetch: 'dashboard', icon: LayoutDashboard },
    { label: 'Boards', href: '/boards', prefetch: 'boards', icon: KanbanSquare },
    { label: 'Carteira', href: '/companies', prefetch: 'companies', icon: Briefcase },
    { label: 'Contatos', href: '/contacts', prefetch: 'contacts', icon: Users },
    { label: 'Automações', href: '/automations', prefetch: 'automations', icon: Zap },
    { label: 'Atividades', href: '/activities', prefetch: 'activities', icon: CheckSquare },
    { label: 'Relatórios', href: '/reports', prefetch: 'reports', icon: BarChart3 },
    { label: 'Manual', href: '/manual', prefetch: 'manual', icon: Book },
    { label: 'Configurações', href: '/settings', prefetch: 'settings', icon: Settings },
];
