import { ManualCategory } from '../types';

export const MANUAL_CONTENT: ManualCategory[] = [
    {
        id: 'overview',
        title: 'Visão Geral',
        articles: [
            {
                id: 'welcome',
                title: 'Bem-vindo ao Flux Leads',
                tags: ['intro', 'começando'],
                content: `
# Bem-vindo ao Flux Leads

O Flux Leads é o sistema CRM central da nossa empresa, desenhado para ajudar você a gerenciar relacionamentos com clientes, acompanhar vendas e organizar suas tarefas diárias.

## O que você pode fazer aqui?
- **Gerenciar Vendas**: Acompanhe suas negociações desde o primeiro contato até o fechamento.
- **Organizar Contatos**: Mantenha todos os dados dos clientes atualizados em um só lugar.
- **Planejar Atividades**: Agende reuniões, ligações e tarefas para não esquecer de nada.
- **Visualizar Relatórios**: Acompanhe seu desempenho e metas.
        `,
            },
            {
                id: 'getting-started',
                title: 'Primeiros Passos',
                tags: ['login', 'perfil'],
                content: `
# Primeiros Passos

Para começar a usar o sistema com eficiência:

1. **Complete seu Perfil**: Adicione uma foto e verifique seus dados em *Configurações > Perfil*.
2. **Configure suas Notificações**: Escolha como quer ser avisado sobre novas atividades.
3. **Explore o Dashboard**: A tela inicial mostra um resumo do seu dia.
        `,
            },
        ],
    },
    {
        id: 'features',
        title: 'Funcionalidades',
        articles: [
            {
                id: 'pipeline',
                title: 'Pipeline (Boards)',
                tags: ['vendas', 'funil', 'kanban'],
                content: `
# Pipeline de Vendas

O Pipeline é o coração do CRM. Ele mostra todas as suas oportunidades de venda em formato de cartões (Kanban).

## Estágios do Funil
1. **Novas Oportunidades**: Leads que acabaram de chegar.
2. **Contatado**: Já houve um primeiro contato.
3. **Proposta**: Uma proposta comercial foi enviada.
4. **Negociação**: Detalhes finais estão sendo discutidos.
5. **Ganho/Perdido**: O resultado final da venda.

## Como usar
- **Arraste e Solte**: Mova os cartões para avançar os estágios.
- **Clique no Cartão**: Abre os detalhes completos do negócio.
        `,
            },
            {
                id: 'activities',
                title: 'Atividades e Tarefas',
                tags: ['agenda', 'tarefa', 'reunião'],
                content: `
# Gestão de Atividades

Nunca perca um follow-up. Use a aba "Atividades" para agendar tudo o que precisa fazer.

## Tipos de Atividade
- 📞 **Ligação**: Chamadas telefônicas ou via WhatsApp.
- 📅 **Reunião**: Presencial ou online.
- 📧 **Email**: Envio de propostas ou dúvidas.
- ✅ **Tarefa**: Ações gerais (ex: "Preparar contrato").

## Negócio Relacionado
Ao criar uma atividade, você verá o campo **"Negócio Relacionado"**.
- **O que é**: Serve para vincular a tarefa a uma venda específica.
- **Por que usar**: Garante que o histórico daquela venda fique completo. Se você ligou para o cliente para falar sobre a Proposta X, vincule ao Deal da Proposta X.
        `,
            },
        ],
    },
    {
        id: 'rules',
        title: 'Regras de Negócio',
        articles: [
            {
                id: 'data-quality',
                title: 'Qualidade dos Dados',
                tags: ['regras', 'cadastro'],
                content: `
# Regras de Cadastro

Para manter nosso CRM organizado, siga estas regras:

1. **Nomes Completos**: Sempre cadastre clientes com Nome e Sobrenome.
2. **Telefone Padronizado**: Use o formato (DD) 9XXXX-XXXX.
3. **E-mail Obrigatório**: Essencial para comunicação e marketing.
4. **Origem do Lead**: Sempre informe de onde o cliente veio (Instagram, Google, Indicação) para sabermos o que funciona melhor.
        `,
            },
            {
                id: 'stagnation',
                title: 'Oportunidades Paradas',
                tags: ['alerta', 'regras'],
                content: `
# Política de Estagnação

Não deixe oportunidades "mofando" no funil.

- **Alerta Amarelo**: 7 dias sem interação.
- **Alerta Vermelho**: 15 dias sem interação.

Se um lead não responde há mais de 30 dias, considere movê-lo para "Perdido" ou devolvê-lo para a base de Marketing para nutrição.
        `,
            },
        ],
    },
];
