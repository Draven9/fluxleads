-- =============================================================
-- Script de Provisionamento de Novo Tenant (Cliente)
-- Uso: Execute via Supabase SQL Editor ou psql
--
-- Instruções de uso:
-- 1. Substitua os valores abaixo antes de executar:
--    - NEW_ORG_NAME    → Nome da empresa do cliente
--    - NEW_OWNER_EMAIL → E-mail do administrador do cliente
--    - NEW_OWNER_NAME  → Nome completo do administrador
--    - NEW_OWNER_PASS  → Senha inicial (mínimo 8 caracteres)
--
-- 2. Após executar este script, o cliente poderá acessar em:
--    https://[sua-url]/login com o e-mail e senha definidos
-- =============================================================

DO $$
DECLARE
  v_org_id    uuid;
  v_board_id  uuid;
  v_user_id   uuid;

  -- ✏️ CONFIGURE AQUI:
  v_org_name  text := 'Empresa do Cliente';
  v_user_email text := 'admin@clienteexemplo.com.br';
  v_user_name  text := 'Administrador Cliente';
  v_user_pass  text := 'senha-segura-aqui';
BEGIN

  -- 1. Criar organização
  INSERT INTO public.organizations (name)
  VALUES (v_org_name)
  RETURNING id INTO v_org_id;

  RAISE NOTICE '✅ Organização criada: % (%)', v_org_name, v_org_id;

  -- 2. Criar Board padrão "Funil de Vendas"
  INSERT INTO public.boards (name, key, organization_id, type, is_default)
  VALUES ('Funil de Vendas', 'funil-de-vendas', v_org_id, 'SALES', true)
  RETURNING id INTO v_board_id;

  RAISE NOTICE '✅ Board criado: % (%)', 'Funil de Vendas', v_board_id;

  -- 3. Criar estágios padrão para o board
  INSERT INTO public.board_stages (board_id, organization_id, name, label, color, "order", is_default)
  VALUES
    (v_board_id, v_org_id, 'lead',           'Novo Lead',          '#6366f1', 1,  true),
    (v_board_id, v_org_id, 'qualificacao',   'Qualificação',       '#3b82f6', 2,  false),
    (v_board_id, v_org_id, 'proposta',       'Proposta Enviada',   '#f59e0b', 3,  false),
    (v_board_id, v_org_id, 'negociacao',     'Em Negociação',      '#ec4899', 4,  false),
    (v_board_id, v_org_id, 'fechado_ganho',  'Fechado (Ganho)',    '#10b981', 5,  false),
    (v_board_id, v_org_id, 'fechado_perdido','Fechado (Perdido)',  '#ef4444', 6,  false);

  RAISE NOTICE '✅ 6 estágios criados para o board.';

  -- 4. Criar usuário admin do cliente via Supabase Auth
  -- NOTA: auth.users não pode ser inserido diretamente via SQL em produção.
  -- Use o painel Supabase > Authentication > Users ou a API Admin abaixo:
  RAISE NOTICE '';
  RAISE NOTICE '📋 PRÓXIMO PASSO OBRIGATÓRIO:';
  RAISE NOTICE '   Crie o usuário admin via Supabase Auth com os seguintes dados:';
  RAISE NOTICE '   Email: %', v_user_email;
  RAISE NOTICE '   Password: [definida no script]';
  RAISE NOTICE '   Metadata: {"organization_id": "%", "name": "%", "role": "admin"}', v_org_id, v_user_name;
  RAISE NOTICE '';
  RAISE NOTICE '✅ Provisionamento de org e board concluído!';
  RAISE NOTICE '   organization_id = %', v_org_id;
  RAISE NOTICE '   board_id        = %', v_board_id;

END;
$$;
