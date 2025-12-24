import { Deal, Activity, DealStatus, Company, Contact, Lead, Product, CustomFieldDefinition, ContactStage, Board, LifecycleStage, DEFAULT_BOARD_STAGES } from '../types';

// Helper to get current month for demo purposes
const currentMonth = new Date().getMonth() + 1;
const currentMonthStr = currentMonth.toString().padStart(2, '0');

// Helper for dates
const daysAgo = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
};

// MOCK DATA: LIFECYCLE STAGES
export const INITIAL_LIFECYCLE_STAGES: LifecycleStage[] = [
  { id: 'LEAD', name: 'Lead', color: 'bg-blue-500', order: 0, isDefault: true },
  { id: 'MQL', name: 'MQL', color: 'bg-yellow-500', order: 1, isDefault: true },
  { id: 'PROSPECT', name: 'Oportunidade', color: 'bg-purple-500', order: 2, isDefault: true },
  { id: 'CUSTOMER', name: 'Cliente', color: 'bg-green-500', order: 3, isDefault: true },
  { id: 'OTHER', name: 'Outros / Perdidos', color: 'bg-slate-500', order: 4, isDefault: true },
];

// MOCK DATA: BOARDS
export const INITIAL_BOARDS: Board[] = [
  {
    id: 'default-sales',
    name: 'Vendas B2B',
    description: 'Pipeline principal de vendas',
    stages: DEFAULT_BOARD_STAGES,
    createdAt: daysAgo(30),
    isDefault: true,
    template: 'SALES',
    goal: {
      description: 'Atingir R$ 500k em vendas no Q4',
      kpi: 'Receita Total',
      targetValue: '500000',
      type: 'currency'
    },
    agentPersona: {
      name: 'Sales Copilot',
      role: 'Assistente de Vendas',
      behavior: 'Focado em fechar negócios e mover deals.'
    }
  },
  {
    id: 'onboarding-board',
    name: 'Onboarding de Clientes',
    description: 'Acompanhamento de novos clientes',
    stages: [
      { id: 'kickoff', label: 'Kickoff', color: 'bg-blue-500' },
      { id: 'setup', label: 'Configuração', color: 'bg-yellow-500' },
      { id: 'training', label: 'Treinamento', color: 'bg-purple-500' },
      { id: 'live', label: 'Go Live', color: 'bg-green-500' }
    ],
    createdAt: daysAgo(25),
    template: 'ONBOARDING'
  }
];

// MOCK DATA: PRODUCTS (Catálogo)
export const INITIAL_PRODUCTS: Product[] = [
  { id: 'prod_1', name: 'Consultoria de Implantação', price: 5000, sku: 'SVC-IMP' },
  { id: 'prod_2', name: 'Licença Enterprise (Seat)', price: 1200, sku: 'LIC-ENT' },
  { id: 'prod_3', name: 'Licença Starter (Seat)', price: 500, sku: 'LIC-STA' },
  { id: 'prod_4', name: 'Treinamento de Equipe', price: 3000, sku: 'SVC-TRA' },
  { id: 'prod_5', name: 'Suporte Premium (Mensal)', price: 800, sku: 'SUB-SUP' },
];

// MOCK DATA: CUSTOM FIELDS
export const INITIAL_CUSTOM_FIELDS: CustomFieldDefinition[] = [
  { id: 'cf_1', key: 'contractStart', label: 'Início do Contrato', type: 'date' },
  { id: 'cf_2', key: 'originSource', label: 'Fonte de Origem', type: 'select', options: ['Google', 'Indicação', 'Evento', 'Outro'] },
];

// MOCK DATA: TAGS
export const INITIAL_TAGS: string[] = ['Novo', 'Urgente', 'Cliente Antigo', 'Indicação', 'Corporativo', 'SaaS', 'High Ticket', 'Inbound', 'Outbound', 'Parceiro'];

// MOCK DATA: LEADS
export const INITIAL_LEADS: Lead[] = [
  { id: 'l1', name: 'Roberto Justus', email: 'roberto@apprent.com', companyName: 'Apprentice Inc', role: 'CEO', source: 'LINKEDIN', status: 'NEW', createdAt: '2023-11-22T09:00:00', notes: 'Interessado em renovação de frota.' },
  { id: 'l2', name: 'Maria Sharapova', email: 'maria@tennis.com', companyName: 'Grand Slam LLC', role: 'Director', source: 'WEBSITE', status: 'NEW', createdAt: '2023-11-22T10:30:00', notes: 'Preencheu formulário de contato.' },
  { id: 'l3', name: 'Elon Musk', email: 'elon@x.com', companyName: 'X Corp', role: 'Owner', source: 'REFERRAL', status: 'NEW', createdAt: '2023-11-21T15:00:00', notes: 'Indicação do investidor.' },
  { id: 'l4', name: 'Jeff Bezos', email: 'jeff@amazon.com', companyName: 'Amazon', role: 'Founder', source: 'MANUAL', status: 'CONTACTED', createdAt: '2023-11-20T11:00:00', notes: 'Encontrado em evento de tecnologia.' },
  { id: 'l5', name: 'Satya Nadella', email: 'satya@microsoft.com', companyName: 'Microsoft', role: 'CEO', source: 'LINKEDIN', status: 'QUALIFIED', createdAt: '2023-11-19T14:00:00', notes: 'Interesse em integração com Azure.' },
];

// MOCK DATA: EMPRESAS
export const INITIAL_COMPANIES: Company[] = [
  { id: 'c1', name: 'Acme Corp', industry: 'Tecnologia', createdAt: '2023-01-01' },
  { id: 'c2', name: 'Stark Industries', industry: 'Defesa', createdAt: '2023-02-15' },
  { id: 'c3', name: 'Pied Piper', industry: 'Software', createdAt: '2023-03-10' },
  { id: 'c4', name: 'Wayne Enterprises', industry: 'Conglomerado', createdAt: '2023-04-01' },
  { id: 'c5', name: 'Cyberdyne Systems', industry: 'Robótica', createdAt: '2023-05-20' },
  { id: 'c6', name: 'TechFlow Solutions', industry: 'SaaS', createdAt: '2023-06-10' },
  { id: 'c7', name: 'Global Logistics', industry: 'Logística', createdAt: '2023-07-05' },
  { id: 'c8', name: 'Green Energy Co', industry: 'Energia', createdAt: '2023-08-12' },
  { id: 'c9', name: 'FinTech Innovators', industry: 'Finanças', createdAt: '2023-09-01' },
  { id: 'c10', name: 'HealthPlus', industry: 'Saúde', createdAt: '2023-09-20' },
  { id: 'c11', name: 'EduLearn Systems', industry: 'Educação', createdAt: '2023-10-05' },
  { id: 'c12', name: 'Retail Giants', industry: 'Varejo', createdAt: '2023-10-15' },
  { id: 'c13', name: 'Creative Agency', industry: 'Marketing', createdAt: '2023-11-01' },
  { id: 'c14', name: 'CloudNine Host', industry: 'Hospedagem', createdAt: '2023-11-10' },
  { id: 'c15', name: 'SecureNet', industry: 'Segurança', createdAt: '2023-11-25' },
];

// MOCK DATA: CONTATOS (With dynamic birthdates for Radar demo)
export const INITIAL_CONTACTS: Contact[] = [
  {
    id: 'contact_1', companyId: 'c1', name: 'João Silva', role: 'CTO', email: 'joao@acme.com', phone: '+5511999990123', birthDate: `1990-${currentMonthStr}-15`, status: 'ACTIVE',
    stage: ContactStage.CUSTOMER,
    lastPurchaseDate: '2023-10-15',
    totalValue: 15000,
    createdAt: '2023-01-10T10:00:00Z'
  },
  {
    id: 'contact_2',
    companyId: 'c2',
    name: 'Carlos Mendes',
    role: 'CTO',
    email: 'carlos@techsolutions.com.br',
    phone: '+5511988888888',
    birthDate: '1980-05-20',
    status: 'ACTIVE',
    stage: ContactStage.PROSPECT,
    lastPurchaseDate: '2023-11-01',
    totalValue: 5000,
    createdAt: '2023-02-15T14:30:00Z'
  },
  {
    id: 'contact_3',
    companyId: 'c1',
    name: 'Mariana Costa',
    role: 'Gerente de Projetos',
    email: 'mariana@acme.com.br',
    phone: '+5511977777777',
    birthDate: '1992-08-10',
    status: 'INACTIVE',
    stage: ContactStage.CUSTOMER,
    lastPurchaseDate: '2023-05-20',
    totalValue: 0,
    createdAt: '2023-03-01T09:00:00Z'
  },
  {
    id: 'contact_4',
    companyId: 'c3',
    name: 'Roberto Almeida',
    role: 'Diretor Financeiro',
    email: 'roberto@globalfin.com.br',
    phone: '+5511966666666',
    birthDate: '1975-11-30',
    status: 'ACTIVE',
    stage: ContactStage.LEAD,
    lastPurchaseDate: '2023-12-05',
    totalValue: 50000,
    createdAt: '2023-04-10T11:20:00Z'
  },
  {
    id: 'contact_5',
    companyId: 'c2',
    name: 'Fernanda Lima',
    role: 'Analista de Sistemas',
    email: 'fernanda@techsolutions.com.br',
    phone: '+5511955555555',
    birthDate: '1995-02-25',
    status: 'ACTIVE',
    stage: ContactStage.MQL,
    lastPurchaseDate: '2023-09-10',
    totalValue: 2000,
    createdAt: '2023-05-20T16:45:00Z'
  },
  {
    id: 'contact_6',
    companyId: 'c4',
    name: 'Paulo Santos',
    role: 'Gerente de Compras',
    email: 'paulo@varejo.com.br',
    phone: '+5511944444444',
    birthDate: '1982-07-15',
    status: 'CHURNED',
    stage: ContactStage.CUSTOMER,
    lastPurchaseDate: '2022-12-01',
    totalValue: 1000,
    createdAt: '2022-11-01T10:00:00Z'
  },
  { id: 'contact_7', companyId: 'c6', name: 'Ana Souza', role: 'CEO', email: 'ana@techflow.com', phone: '+5511911111111', birthDate: '1985-03-10', status: 'ACTIVE', stage: ContactStage.PROSPECT, lastPurchaseDate: '', totalValue: 0, createdAt: '2023-06-15T10:00:00Z' },
  { id: 'contact_8', companyId: 'c7', name: 'Bruno Lima', role: 'Gerente de Operações', email: 'bruno@global.com', phone: '+5511922222222', birthDate: '1978-06-20', status: 'ACTIVE', stage: ContactStage.LEAD, lastPurchaseDate: '', totalValue: 0, createdAt: '2023-07-10T14:00:00Z' },
  { id: 'contact_9', companyId: 'c8', name: 'Carla Dias', role: 'Diretora de Sustentabilidade', email: 'carla@green.com', phone: '+5511933333333', birthDate: '1990-09-05', status: 'ACTIVE', stage: ContactStage.MQL, lastPurchaseDate: '', totalValue: 0, createdAt: '2023-08-15T09:30:00Z' },
  { id: 'contact_10', companyId: 'c9', name: 'Daniel Rocha', role: 'CTO', email: 'daniel@fintech.com', phone: '+5511944444444', birthDate: '1988-12-12', status: 'ACTIVE', stage: ContactStage.CUSTOMER, lastPurchaseDate: '2023-11-01', totalValue: 25000, createdAt: '2023-09-05T11:00:00Z' },
  { id: 'contact_11', companyId: 'c10', name: 'Elena Torres', role: 'Gerente Médica', email: 'elena@health.com', phone: '+5511955555555', birthDate: '1982-04-15', status: 'ACTIVE', stage: ContactStage.PROSPECT, lastPurchaseDate: '', totalValue: 0, createdAt: '2023-09-25T15:00:00Z' },
  { id: 'contact_12', companyId: 'c11', name: 'Felipe Martins', role: 'Reitor', email: 'felipe@edulearn.com', phone: '+5511966666666', birthDate: '1975-01-20', status: 'ACTIVE', stage: ContactStage.LEAD, lastPurchaseDate: '', totalValue: 0, createdAt: '2023-10-10T10:00:00Z' },
  { id: 'contact_13', companyId: 'c12', name: 'Gabriela Silva', role: 'Diretora de Vendas', email: 'gabriela@retail.com', phone: '+5511977777777', birthDate: '1993-07-08', status: 'ACTIVE', stage: ContactStage.MQL, lastPurchaseDate: '', totalValue: 0, createdAt: '2023-10-20T13:30:00Z' },
  { id: 'contact_14', companyId: 'c13', name: 'Hugo Alves', role: 'Diretor Criativo', email: 'hugo@creative.com', phone: '+5511988888888', birthDate: '1989-11-02', status: 'ACTIVE', stage: ContactStage.CUSTOMER, lastPurchaseDate: '2023-11-15', totalValue: 10000, createdAt: '2023-11-05T09:00:00Z' },
  { id: 'contact_15', companyId: 'c14', name: 'Isabela Costa', role: 'Gerente de TI', email: 'isabela@cloud.com', phone: '+5511999999999', birthDate: '1991-05-18', status: 'ACTIVE', stage: ContactStage.PROSPECT, lastPurchaseDate: '', totalValue: 0, createdAt: '2023-11-15T16:00:00Z' },
  { id: 'contact_16', companyId: 'c15', name: 'Jorge Pereira', role: 'CISO', email: 'jorge@secure.com', phone: '+5511900000000', birthDate: '1980-08-22', status: 'ACTIVE', stage: ContactStage.LEAD, lastPurchaseDate: '', totalValue: 0, createdAt: '2023-11-28T10:00:00Z' },
];

// MOCK DATA: NEGÓCIOS
export const INITIAL_DEALS: Deal[] = [
  {
    id: '1',
    title: 'Licença Corporativa - 50 Seats',
    companyId: 'c1',
    contactId: 'contact_1',
    boardId: 'default-sales',
    value: 50000,
    items: [],
    status: DealStatus.NEGOTIATION,
    createdAt: daysAgo(20),
    updatedAt: daysAgo(2), // Active
    probability: 70,
    priority: 'high',
    owner: { name: 'Thales Laray', avatar: '/profile.jpg' },
    nextActivity: { type: 'MEETING', date: new Date(Date.now() + 86400000 * 2).toISOString(), isOverdue: false },
    tags: ['Corporativo', 'SaaS'],
    customFields: { contractStart: '2024-01-01', originSource: 'Indicação' },
    isWon: false,
    isLost: false,
  },
  {
    id: '2',
    title: 'Consultoria de Segurança',
    companyId: 'c2',
    contactId: 'contact_2',
    boardId: 'default-sales',
    value: 120000,
    items: [],
    status: DealStatus.PROPOSAL,
    createdAt: daysAgo(15),
    updatedAt: daysAgo(12), // STALLED (> 7 days)
    probability: 60,
    priority: 'high',
    owner: { name: 'Pepper Potts', avatar: 'https://i.pravatar.cc/150?u=pepper' },
    nextActivity: { type: 'EMAIL', date: daysAgo(1), isOverdue: true }, // OVERDUE
    tags: ['Consultoria', 'High Ticket'],
    customFields: {},
    isWon: false,
    isLost: false,
  },
  {
    id: '3',
    title: 'Plano Starter',
    companyId: 'c3',
    contactId: 'contact_4',
    boardId: 'default-sales',
    value: 5000,
    items: [],
    status: DealStatus.NEW,
    createdAt: daysAgo(10),
    updatedAt: daysAgo(10), // STALLED
    probability: 20,
    priority: 'low',
    owner: { name: 'Dinesh C', avatar: 'https://i.pravatar.cc/150?u=dinesh' },
    tags: ['Startup', 'Inbound'],
    customFields: {},
    isWon: false,
    isLost: false,
  },
  {
    id: 'd3',
    title: 'Licença Enterprise',
    companyId: 'c2',
    contactId: 'contact_5',
    boardId: 'default-sales',
    value: 50000,
    items: [],
    status: DealStatus.NEGOTIATION,
    createdAt: daysAgo(45),
    updatedAt: daysAgo(15),
    lastStageChangeDate: daysAgo(15), // Stagnant (>10 days)
    probability: 70,
    priority: 'high',
    owner: { name: 'Eu', avatar: 'https://i.pravatar.cc/150?u=me' },
    tags: ['Q4', 'Enterprise'],
    customFields: {},
    isWon: false,
    isLost: false,
  },
  {
    id: '5',
    title: 'Rollout Global Enterprise',
    companyId: 'c4',
    contactId: 'contact_6',
    boardId: 'default-sales',
    value: 450000,
    items: [],
    status: DealStatus.NEW,
    createdAt: daysAgo(1),
    updatedAt: daysAgo(1),
    probability: 10,
    priority: 'high',
    owner: { name: 'Lucius Fox', avatar: 'https://i.pravatar.cc/150?u=lucius' },
    tags: ['Corporativo', 'VIP'],
    customFields: {},
    isWon: false,
    isLost: false,
  },
  {
    id: '6',
    title: 'Protótipo IA T-800',
    companyId: 'c5',
    contactId: 'contact_2', // Reusing contact_2 as p6 didn't exist and c5 is Cyberdyne
    boardId: 'default-sales',
    value: 25000,
    items: [],
    status: DealStatus.CLOSED_WON, // WON DEAL
    createdAt: daysAgo(60),
    updatedAt: daysAgo(45), // OLD ENOUGH FOR UPSELL (> 30 days)
    probability: 100,
    priority: 'medium',
    owner: { name: 'Thales Laray', avatar: '/profile.jpg' },
    tags: ['Hardware', 'Inovação'],
    customFields: {},
    isWon: true,
    isLost: false,
    closedAt: daysAgo(45),
  },
  { id: '7', title: 'Migração Cloud AWS', companyId: 'c6', contactId: 'contact_7', boardId: 'default-sales', value: 80000, items: [], status: DealStatus.PROPOSAL, createdAt: daysAgo(10), updatedAt: daysAgo(2), probability: 50, priority: 'high', owner: { name: 'Thales Laray', avatar: '/profile.jpg' }, tags: ['Cloud', 'Infra'], customFields: {}, isWon: false, isLost: false },
  { id: '8', title: 'Sistema de Rastreamento', companyId: 'c7', contactId: 'contact_8', boardId: 'default-sales', value: 150000, items: [], status: DealStatus.NEGOTIATION, createdAt: daysAgo(25), updatedAt: daysAgo(5), probability: 80, priority: 'high', owner: { name: 'Pepper Potts', avatar: 'https://i.pravatar.cc/150?u=pepper' }, tags: ['Logística', 'IoT'], customFields: {}, isWon: false, isLost: false },
  { id: '9', title: 'Consultoria ESG', companyId: 'c8', contactId: 'contact_9', boardId: 'default-sales', value: 40000, items: [], status: DealStatus.CONTACTED, createdAt: daysAgo(5), updatedAt: daysAgo(1), probability: 30, priority: 'medium', owner: { name: 'Dinesh C', avatar: 'https://i.pravatar.cc/150?u=dinesh' }, tags: ['ESG', 'Consultoria'], customFields: {}, isWon: false, isLost: false },
  { id: '10', title: 'API de Pagamentos', companyId: 'c9', contactId: 'contact_10', boardId: 'default-sales', value: 200000, items: [], status: DealStatus.CLOSED_WON, createdAt: daysAgo(60), updatedAt: daysAgo(10), probability: 100, priority: 'high', owner: { name: 'Lucius Fox', avatar: 'https://i.pravatar.cc/150?u=lucius' }, tags: ['Fintech', 'API'], customFields: {}, isWon: true, isLost: false, closedAt: daysAgo(10) },
  { id: '11', title: 'Software de Prontuário', companyId: 'c10', contactId: 'contact_11', boardId: 'default-sales', value: 95000, items: [], status: DealStatus.PROPOSAL, createdAt: daysAgo(15), updatedAt: daysAgo(3), probability: 60, priority: 'medium', owner: { name: 'Thales Laray', avatar: '/profile.jpg' }, tags: ['Saúde', 'SaaS'], customFields: {}, isWon: false, isLost: false },
  { id: '12', title: 'Plataforma EAD', companyId: 'c11', contactId: 'contact_12', boardId: 'default-sales', value: 60000, items: [], status: DealStatus.NEW, createdAt: daysAgo(2), updatedAt: daysAgo(2), probability: 10, priority: 'low', owner: { name: 'Pepper Potts', avatar: 'https://i.pravatar.cc/150?u=pepper' }, tags: ['Educação', 'LMS'], customFields: {}, isWon: false, isLost: false },
  { id: '13', title: 'Integração E-commerce', companyId: 'c12', contactId: 'contact_13', boardId: 'default-sales', value: 35000, items: [], status: DealStatus.CONTACTED, createdAt: daysAgo(8), updatedAt: daysAgo(4), probability: 40, priority: 'medium', owner: { name: 'Dinesh C', avatar: 'https://i.pravatar.cc/150?u=dinesh' }, tags: ['Varejo', 'Integração'], customFields: {}, isWon: false, isLost: false },
  { id: '14', title: 'Campanha Q1 2024', companyId: 'c13', contactId: 'contact_14', boardId: 'default-sales', value: 25000, items: [], status: DealStatus.CLOSED_WON, createdAt: daysAgo(40), updatedAt: daysAgo(5), probability: 100, priority: 'low', owner: { name: 'Lucius Fox', avatar: 'https://i.pravatar.cc/150?u=lucius' }, tags: ['Marketing', 'Serviço'], customFields: {}, isWon: true, isLost: false, closedAt: daysAgo(5) },
  { id: '15', title: 'Servidor Dedicado', companyId: 'c14', contactId: 'contact_15', boardId: 'default-sales', value: 12000, items: [], status: DealStatus.PROPOSAL, createdAt: daysAgo(12), updatedAt: daysAgo(1), probability: 50, priority: 'medium', owner: { name: 'Thales Laray', avatar: '/profile.jpg' }, tags: ['Hosting', 'Infra'], customFields: {}, isWon: false, isLost: false },
  { id: '16', title: 'Pentest Completo', companyId: 'c15', contactId: 'contact_16', boardId: 'default-sales', value: 45000, items: [], status: DealStatus.NEW, createdAt: daysAgo(3), updatedAt: daysAgo(3), probability: 20, priority: 'high', owner: { name: 'Pepper Potts', avatar: 'https://i.pravatar.cc/150?u=pepper' }, tags: ['Segurança', 'Audit'], customFields: {}, isWon: false, isLost: false },
];

// Helper to create dates for this week
const getThisWeek = (dayOffset: number, hour: number, minute: number = 0) => {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sunday
  const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Get to Monday
  const targetDate = new Date(today);
  targetDate.setDate(today.getDate() + daysToMonday + dayOffset);
  targetDate.setHours(hour, minute, 0, 0);
  return targetDate.toISOString();
};

export const INITIAL_ACTIVITIES: Activity[] = [
  // SEGUNDA-FEIRA (dayOffset = 0)
  { id: 'a1', dealId: '1', dealTitle: 'Licença Corporativa', type: 'CALL', title: 'Ligação de Prospecção - Acme', description: 'Primeiro contato com decisor técnico', date: getThisWeek(0, 9, 0), user: { name: 'Thales', avatar: '/profile.jpg' }, completed: false },
  { id: 'a2', dealId: '2', dealTitle: 'Consultoria de Segurança', type: 'MEETING', title: 'Demo do Produto - Stark', description: 'Apresentar módulos de segurança', date: getThisWeek(0, 10, 30), user: { name: 'Pepper', avatar: 'https://i.pravatar.cc/150?u=pepper' }, completed: false },
  { id: 'a3', dealId: '3', dealTitle: 'Plano Starter', type: 'EMAIL', title: 'Enviar Proposta Comercial', description: 'Proposta com desconto progressivo', date: getThisWeek(0, 14, 0), user: { name: 'Dinesh', avatar: 'https://i.pravatar.cc/150?u=dinesh' }, completed: false },
  { id: 'a4', dealId: '5', dealTitle: 'Rollout Global', type: 'TASK', title: 'Preparar Apresentação Board', description: 'Slides para comitê executivo', date: getThisWeek(0, 16, 0), user: { name: 'Lucius', avatar: 'https://i.pravatar.cc/150?u=lucius' }, completed: false },

  // TERÇA-FEIRA (dayOffset = 1)
  { id: 'a5', dealId: '1', dealTitle: 'Licença Corporativa', type: 'MEETING', title: 'Reunião Técnica - Arquitetura', description: 'Alinhamento de infraestrutura', date: getThisWeek(1, 9, 0), user: { name: 'Thales', avatar: '/profile.jpg' }, completed: false },
  { id: 'a6', dealId: 'd3', dealTitle: 'Licença Enterprise', type: 'CALL', title: 'Follow-up Proposta', description: 'Resolver objeções de preço', date: getThisWeek(1, 11, 0), user: { name: 'Eu', avatar: 'https://i.pravatar.cc/150?u=me' }, completed: false },
  { id: 'a7', dealId: '2', dealTitle: 'Consultoria de Segurança', type: 'EMAIL', title: 'Enviar Case de Sucesso', description: 'Cases similares do setor', date: getThisWeek(1, 13, 0), user: { name: 'Pepper', avatar: 'https://i.pravatar.cc/150?u=pepper' }, completed: false },
  { id: 'a8', dealId: '3', dealTitle: 'Plano Starter', type: 'CALL', title: 'Negociação de Fechamento', description: 'Última rodada de negociação', date: getThisWeek(1, 15, 30), user: { name: 'Dinesh', avatar: 'https://i.pravatar.cc/150?u=dinesh' }, completed: false },

  // QUARTA-FEIRA (dayOffset = 2)
  { id: 'a9', dealId: '5', dealTitle: 'Rollout Global', type: 'MEETING', title: 'Apresentação ao Board', description: 'Pitch para diretoria', date: getThisWeek(2, 10, 0), user: { name: 'Lucius', avatar: 'https://i.pravatar.cc/150?u=lucius' }, completed: false },
  { id: 'a10', dealId: '1', dealTitle: 'Licença Corporativa', type: 'TASK', title: 'Revisar Contrato', description: 'Enviar para jurídico', date: getThisWeek(2, 12, 0), user: { name: 'Thales', avatar: '/profile.jpg' }, completed: false },
  { id: 'a11', dealId: 'd3', dealTitle: 'Licença Enterprise', type: 'MEETING', title: 'Workshop de Onboarding', description: 'Treinamento da equipe', date: getThisWeek(2, 14, 0), user: { name: 'Eu', avatar: 'https://i.pravatar.cc/150?u=me' }, completed: false },
  { id: 'a12', dealId: '2', dealTitle: 'Consultoria de Segurança', type: 'CALL', title: 'Ligação com CFO', description: 'Aprovação orçamentária', date: getThisWeek(2, 16, 30), user: { name: 'Pepper', avatar: 'https://i.pravatar.cc/150?u=pepper' }, completed: false },

  // QUINTA-FEIRA (dayOffset = 3)
  { id: 'a13', dealId: '3', dealTitle: 'Plano Starter', type: 'EMAIL', title: 'Contrato Assinado', description: 'Enviar boas-vindas', date: getThisWeek(3, 9, 0), user: { name: 'Dinesh', avatar: 'https://i.pravatar.cc/150?u=dinesh' }, completed: false },
  { id: 'a14', dealId: '1', dealTitle: 'Licença Corporativa', type: 'MEETING', title: 'Kickoff do Projeto', description: 'Reunião de início', date: getThisWeek(3, 11, 0), user: { name: 'Thales', avatar: '/profile.jpg' }, completed: false },
  { id: 'a15', dealId: '5', dealTitle: 'Rollout Global', type: 'CALL', title: 'Feedback do Board', description: 'Alinhar próximos passos', date: getThisWeek(3, 13, 30), user: { name: 'Lucius', avatar: 'https://i.pravatar.cc/150?u=lucius' }, completed: false },
  { id: 'a16', dealId: 'd3', dealTitle: 'Licença Enterprise', type: 'TASK', title: 'Preparar Relatório Executivo', description: 'Métricas de ROI', date: getThisWeek(3, 15, 0), user: { name: 'Eu', avatar: 'https://i.pravatar.cc/150?u=me' }, completed: false },

  // SEXTA-FEIRA (dayOffset = 4)
  { id: 'a17', dealId: '2', dealTitle: 'Consultoria de Segurança', type: 'MEETING', title: 'Revisão de Proposta Final', description: 'Ajustes finais e fechamento', date: getThisWeek(4, 10, 0), user: { name: 'Pepper', avatar: 'https://i.pravatar.cc/150?u=pepper' }, completed: false },
  { id: 'a18', dealId: '1', dealTitle: 'Licença Corporativa', type: 'EMAIL', title: 'Enviar Documentação', description: 'Manuais e credenciais', date: getThisWeek(4, 12, 0), user: { name: 'Thales', avatar: '/profile.jpg' }, completed: false },
  { id: 'a19', dealId: '5', dealTitle: 'Rollout Global', type: 'CALL', title: 'Negociação de Valores', description: 'Discussão de investimento', date: getThisWeek(4, 14, 30), user: { name: 'Lucius', avatar: 'https://i.pravatar.cc/150?u=lucius' }, completed: false },
  { id: 'a20', dealId: 'd3', dealTitle: 'Licença Enterprise', type: 'TASK', title: 'Review Semanal', description: 'Consolidar relatório da semana', date: getThisWeek(4, 17, 0), user: { name: 'Eu', avatar: 'https://i.pravatar.cc/150?u=me' }, completed: false },

  // NOVAS ATIVIDADES PARA OS NOVOS DEALS
  { id: 'a21', dealId: '7', dealTitle: 'Migração Cloud AWS', type: 'MEETING', title: 'Levantamento de Requisitos', description: 'Mapear infra atual', date: getThisWeek(0, 14, 0), user: { name: 'Thales', avatar: '/profile.jpg' }, completed: false },
  { id: 'a22', dealId: '8', dealTitle: 'Sistema de Rastreamento', type: 'CALL', title: 'Alinhamento Técnico', description: 'Falar com equipe de TI', date: getThisWeek(1, 10, 0), user: { name: 'Pepper', avatar: 'https://i.pravatar.cc/150?u=pepper' }, completed: false },
  { id: 'a23', dealId: '9', dealTitle: 'Consultoria ESG', type: 'EMAIL', title: 'Enviar Escopo', description: 'Detalhar etapas da consultoria', date: getThisWeek(2, 11, 0), user: { name: 'Dinesh', avatar: 'https://i.pravatar.cc/150?u=dinesh' }, completed: false },
  { id: 'a24', dealId: '11', dealTitle: 'Software de Prontuário', type: 'MEETING', title: 'Demo para Médicos', description: 'Apresentar usabilidade', date: getThisWeek(3, 16, 0), user: { name: 'Thales', avatar: '/profile.jpg' }, completed: false },
  { id: 'a25', dealId: '13', dealTitle: 'Integração E-commerce', type: 'CALL', title: 'Check de Integração', description: 'Validar API keys', date: getThisWeek(4, 9, 30), user: { name: 'Dinesh', avatar: 'https://i.pravatar.cc/150?u=dinesh' }, completed: false },
  { id: 'a26', dealId: '15', dealTitle: 'Servidor Dedicado', type: 'TASK', title: 'Provisionar Servidor', description: 'Setup inicial', date: getThisWeek(1, 14, 0), user: { name: 'Thales', avatar: '/profile.jpg' }, completed: false },
  { id: 'a27', dealId: '16', dealTitle: 'Pentest Completo', type: 'MEETING', title: 'Kickoff de Segurança', description: 'Definir escopo do teste', date: getThisWeek(2, 15, 0), user: { name: 'Pepper', avatar: 'https://i.pravatar.cc/150?u=pepper' }, completed: false },

  // Algumas atividades concluídas (passadas)
  { id: 'past1', dealId: '1', dealTitle: 'Licença Corporativa', type: 'MEETING', title: 'Reunião de Kickoff', description: 'Alinhamento inicial de escopo com a diretoria.', date: daysAgo(2), user: { name: 'Thales', avatar: '/profile.jpg' }, completed: true },
  { id: 'past2', dealId: '2', dealTitle: 'Consultoria de Segurança', type: 'EMAIL', title: 'Enviou Proposta v1', description: 'Proposta anexada via email.', date: daysAgo(5), user: { name: 'Pepper', avatar: 'https://i.pravatar.cc/150?u=pepper' }, completed: true },
  { id: 'past3', dealId: '10', dealTitle: 'API de Pagamentos', type: 'CALL', title: 'Fechamento de Contrato', description: 'Assinatura final', date: daysAgo(10), user: { name: 'Lucius', avatar: 'https://i.pravatar.cc/150?u=lucius' }, completed: true },
  { id: 'past4', dealId: '14', dealTitle: 'Campanha Q1 2024', type: 'MEETING', title: 'Briefing Criativo', description: 'Definição de conceito', date: daysAgo(15), user: { name: 'Lucius', avatar: 'https://i.pravatar.cc/150?u=lucius' }, completed: true },
];
