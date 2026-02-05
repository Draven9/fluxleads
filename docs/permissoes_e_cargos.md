# Permissões e Cargos

O NossoCRM possui um sistema de controle de acesso baseado em cargos (RBAC). Abaixo estão os detalhes de cada cargo e suas permissões.

## Cargos Disponíveis

### 👑 Administrador (`admin`)
Acesso total ao sistema.
- **Pode ver tudo**: Todos os deals, contatos, atividades e relatórios financeiros.
- **Gestão de Equipe**: Pode criar, editar e remover usuários.
- **Configurações**: Pode alterar configurações da organização, IA e integrações.
- **Exportação**: Pode exportar dados.

### 💼 Gerente (`gerente`)
Focado na gestão da operação de vendas, sem acesso a configurações críticas do sistema.
- **Visão Ampla**: Pode ver todos os deals e contatos da equipe.
- **Gestão de Equipe**: Pode convidar e editar membros da equipe (vendedores e suporte).
- **Relatórios**: Acesso a métricas de receita e desempenho.
- **Restrições**: Não pode alterar configurações de cobrança ou integrar webhooks/APIs globais.

### 👤 Vendedor (`vendedor`)
Focado em suas próprias vendas e atividades.
- **Pipeline**: Pode criar e gerenciar seus próprios deals.
- **Visão de Equipe**: Pode ver deals de outros vendedores (dependendo da configuração da organização, geralmente "Todos" ou apenas "Próprios").
- **Restrições**:
  - Não acessa configurações administrativas.
  - Não pode exportar base de dados (segurança).
  - Não gerencia outros usuários.

### 🎧 Suporte (`suporte`)
Acesso limitado para atendimento e pós-venda.
- **Consultivo**: Pode ver contatos e detalhes de clientes.
- **Atividades**: Pode registrar interações e tarefas.
- **Restrições**:
  - Não vê valores financeiros (Revenue).
  - Não altera estágios de funil de vendas (opcional).
  - Acesso restrito a configurações.

### 🤝 Colaborador (`colaborador`)
Acesso mínimo para participação pontual.
- Geralmente usado para membros externos ou temporários.
- Acesso muito restrito a funcionalidades básicas.

## Matriz de Permissões

| Permissão | Admin | Gerente | Vendedor | Suporte |
|-----------|:-----:|:-------:|:--------:|:-------:|
| **Criar/Editar Deals** | ✅ | ✅ | ✅ | ✅ |
| **Ver Receita/Financeiro** | ✅ | ✅ | ✅ | ❌ |
| **Ver Todos os Deals** | ✅ | ✅ | ✅ | ❌ |
| **Gerenciar Equipe** | ✅ | ✅ | ❌ | ❌ |
| **Exportar Contatos** | ✅ | ❌ | ❌ | ❌ |
| **Configurações do Sistema** | ✅ | ❌ | ❌ | ❌ |
| **Integrações/API** | ✅ | ❌ | ❌ | ❌ |

## Como Gerenciar Cargos

Para alterar o cargo de um usuário:
1. Vá em **Configurações → Equipe**.
2. Clique no ícone de lápis (Editar) ao lado do usuário.
3. No campo "Cargo", selecione a nova função.
4. Clique em "Salvar Alterações".
