# context-mode — Regras de roteamento obrigatórias

Você tem as ferramentas MCP do context-mode disponíveis. Estas regras NÃO são opcionais — elas protegem o context window contra flooding. Um único comando sem roteamento pode despejar 56 KB no contexto e desperdiçar toda a sessão.

## Comandos BLOQUEADOS — não tente usá-los

### curl / wget — BLOQUEADO
Qualquer comando Bash contendo `curl` ou `wget` é interceptado. NÃO tente novamente.
Use em vez disso:
- `ctx_fetch_and_index(url, source)` para buscar e indexar páginas web
- `ctx_execute(language: "javascript", code: "const r = await fetch(...)")` para chamadas HTTP no sandbox

### WebFetch — BLOQUEADO
Chamadas WebFetch são negadas inteiramente.
Use em vez disso:
- `ctx_fetch_and_index(url, source)` depois `ctx_search(queries)` para consultar o conteúdo indexado

## Ferramentas REDIRECIONADAS — use equivalentes sandbox

### Bash (output >20 linhas)
Bash é APENAS para: `git`, `mkdir`, `rm`, `mv`, `cd`, `ls`, `npm install`, e outros comandos de output curto.
Para todo o resto, use:
- `ctx_batch_execute(commands, queries)` — rode múltiplos comandos + busca em UMA chamada
- `ctx_execute(language: "shell", code: "...")` — rode no sandbox, só stdout entra no contexto

### Bash: build / typecheck / tests
Sempre use sandbox para comandos pesados:
- `npx tsc --noEmit` → `ctx_execute(language: "shell", code: "npx tsc --noEmit")`
- `npm run build` → `ctx_execute(language: "shell", code: "npm run build")`
- `npm run test:run` → `ctx_execute(language: "shell", code: "npm run test:run")`

### Read (para análise)
Se você está lendo um arquivo para **Editar** → Read é correto (Edit precisa do conteúdo no contexto).
Se você está lendo para **analisar, explorar ou resumir** → use `ctx_execute_file(path, language, code)`. Só o resumo impresso entra no contexto.

### Grep (resultados grandes)
Resultados de Grep podem inundar o contexto. Use `ctx_execute(language: "shell", code: "grep ...")` para rodar buscas no sandbox.

## Hierarquia de seleção de ferramentas

1. **COLETAR**: `ctx_batch_execute(commands, queries)` — Ferramenta primária. Roda todos os comandos, auto-indexa output, retorna resultados de busca. UMA chamada substitui 30+ chamadas individuais.
2. **FOLLOW-UP**: `ctx_search(queries: ["q1", "q2", ...])` — Consulte conteúdo indexado. Passe TODAS as perguntas como array em UMA chamada.
3. **PROCESSAMENTO**: `ctx_execute(language, code)` | `ctx_execute_file(path, language, code)` — Execução em sandbox. Só stdout entra no contexto.
4. **WEB**: `ctx_fetch_and_index(url, source)` depois `ctx_search(queries)` — Busca, chunka, indexa, consulta. HTML bruto nunca entra no contexto.
5. **INDEXAR**: `ctx_index(content, source)` — Armazena conteúdo no índice FTS5 para busca posterior.

## Restrições de output

- Respostas curtas e diretas.
- Escreva artefatos (código, configs) em ARQUIVOS — nunca retorne como texto inline. Retorne apenas: caminho do arquivo + descrição de 1 linha.

## Comandos ctx

| Comando | Ação |
|---------|------|
| `ctx stats` | Chama `ctx_stats` MCP tool — exibe economia de contexto por ferramenta |
| `ctx doctor` | Chama `ctx_doctor` MCP tool — diagnóstico de runtimes, hooks, FTS5 |
| `ctx upgrade` | Chama `ctx_upgrade` MCP tool — atualiza para a versão mais recente |
