/**
 * Debug Mode - Sistema de geração de dados fake para testes
 * 
 * Ativar: localStorage.setItem('DEBUG_MODE', 'true')
 * Desativar: localStorage.removeItem('DEBUG_MODE')
 * 
 * Ou via console: window.enableDebugMode() / window.disableDebugMode()
 */

import { faker } from '@faker-js/faker/locale/pt_BR';

// ============================================
// DEBUG MODE CHECK
// ============================================

export const isDebugMode = (): boolean => {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('DEBUG_MODE') === 'true';
};

export const enableDebugMode = (): void => {
  localStorage.setItem('DEBUG_MODE', 'true');
  console.log('🐛 Debug mode ENABLED - Refresh para ver os botões');
};

export const disableDebugMode = (): void => {
  localStorage.removeItem('DEBUG_MODE');
  console.log('🐛 Debug mode DISABLED - Refresh para esconder os botões');
};

// Expõe no window para fácil acesso via console
if (typeof window !== 'undefined') {
  (window as any).enableDebugMode = enableDebugMode;
  (window as any).disableDebugMode = disableDebugMode;
  (window as any).isDebugMode = isDebugMode;
}

// ============================================
// FAKE DATA GENERATORS
// ============================================

export const fakeContact = () => ({
  name: faker.person.fullName(),
  email: faker.internet.email().toLowerCase(),
  phone: faker.helpers.fromRegExp(/\+55[1-9]{2}9[0-9]{8}/),
  role: faker.person.jobTitle(),
  companyName: faker.company.name(),
});

export const fakeCompany = () => ({
  name: faker.company.name(),
  industry: faker.helpers.arrayElement([
    'Tecnologia',
    'Varejo',
    'Saúde',
    'Educação',
    'Financeiro',
    'Indústria',
    'Serviços',
    'Construção',
    'Alimentação',
    'Logística',
  ]),
  website: faker.internet.url(),
  employees: faker.helpers.arrayElement(['1-10', '11-50', '51-200', '201-500', '500+']),
});

export const fakeDeal = () => ({
  title: `${faker.commerce.productAdjective()} ${faker.commerce.product()}`,
  value: faker.number.int({ min: 1000, max: 500000 }),
  probability: faker.helpers.arrayElement([10, 20, 30, 40, 50, 60, 70, 80, 90]),
  priority: faker.helpers.arrayElement(['low', 'medium', 'high'] as const),
  tags: faker.helpers.arrayElements(
    ['Urgente', 'Enterprise', 'Renovação', 'Upsell', 'Novo Cliente', 'Indicação'],
    faker.number.int({ min: 0, max: 3 })
  ),
  notes: faker.lorem.sentence(),
});

export const fakeActivity = () => ({
  title: faker.helpers.arrayElement([
    'Reunião de apresentação',
    'Ligação de follow-up',
    'Enviar proposta comercial',
    'Demo do produto',
    'Negociar contrato',
    'Visita ao cliente',
    'Apresentar case de sucesso',
    'Alinhar expectativas',
  ]),
  description: faker.lorem.sentence(),
  type: faker.helpers.arrayElement(['CALL', 'MEETING', 'TASK', 'EMAIL'] as const),
  date: faker.date.soon({ days: 14 }).toISOString(),
});

export const fakeProduct = () => ({
  name: faker.commerce.productName(),
  price: faker.number.float({ min: 100, max: 10000, fractionDigits: 2 }),
  description: faker.commerce.productDescription(),
});

// ============================================
// BULK GENERATORS
// ============================================

export const generateFakeContacts = (count: number = 5) => {
  return Array.from({ length: count }, () => fakeContact());
};

export const generateFakeDeals = (count: number = 5) => {
  return Array.from({ length: count }, () => fakeDeal());
};

// ============================================
// DEBUG BUTTON STYLES
// ============================================

export const debugButtonStyles = {
  base: 'inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded border transition-colors',
  primary: 'bg-purple-100 text-purple-700 border-purple-300 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700 dark:hover:bg-purple-800/40',
  secondary: 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700',
  danger: 'bg-red-100 text-red-700 border-red-300 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700 dark:hover:bg-red-800/40',
};
