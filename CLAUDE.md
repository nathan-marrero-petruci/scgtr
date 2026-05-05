# CLAUDE.md — Euphonia

> Este arquivo define o comportamento obrigatório do Claude Code e os padrões de todos os projetos.
> Todo agente do pipeline deve ler e seguir este documento integralmente.

---

## COMPORTAMENTO OBRIGATÓRIO DO CLAUDE CODE

### Regra #1 — Pipeline sempre

Nenhum código é entregue diretamente. Todo pedido de criação, alteração ou refatoração passa obrigatoriamente pelas 6 etapas abaixo antes de ser escrito no projeto.

Para rodar os 6 agentes como processos independentes (recomendado para features novas):

```bash
npx tsx pipeline.ts "descreva a tarefa aqui"
```

Quando respondendo diretamente no chat, simule as 6 etapas explicitamente, uma por vez, antes de entregar qualquer código. Nunca pule etapas. Nunca entregue código sem passar por todas. Estruture sua resposta assim:

---

🏗️ **[ARQUITETURA]** — liste os arquivos que serão criados e a responsabilidade de cada um

💻 **[DEV]** — escreva o código seguindo os padrões do CLAUDE.md

🧪 **[QA]** — analise o código gerado. Se encontrar problemas, volte ao DEV e corrija antes de continuar. Entregue o documento de smoke tests ao final.

🔒 **[SECURITY]** — analise vulnerabilidades. Se encontrar, volte ao DEV e corrija antes de continuar.

✅ **[APROVADOR]** — valide se atende à tarefa, segue o CLAUDE.md e passou pelo QA e Security. Se não, volte ao DEV.

📝 **[DOCS]** — gere a documentação e atualize o README.md.

## ➡️ **[ENTREGA]** — só aqui o código é apresentado ao usuário.

### Regra #2 — Fluxo do pipeline

```
Arquitetura → Dev → QA (com smoke tests) → Security → Aprovador → Documentação → ✅ entrega
```

Cada etapa com loop de feedback:

- Se reprovado: Dev corrige e volta para o agente que reprovou
- Máximo de **3 tentativas por etapa**
- Se esgotar tentativas: reportar o problema ao usuário, não escrever código
- Só escrever arquivos no projeto após aprovação do Aprovador

**Papel de cada agente:**

🏗️ **Arquitetura** — Define antes do Dev: quais arquivos serão criados, quais funções existirão, como a feature se encaixa na estrutura existente do projeto. Aplica os princípios de UX da seção 4 (Cognição Zero) ao definir fluxos e telas — ação primária above the fold, zero decisões ambíguas, CTA dominante por tela. O Dev segue esse plano.

💻 **Dev Full Stack Sênior** — Implementa seguindo o plano de arquitetura e os padrões do CLAUDE.md.

🧪 **QA Sênior** — Analisa o código e entrega dois outputs:

1. Parecer técnico: bugs, casos de borda, loading/error states, nomenclatura, testes
2. Documento de Smoke Tests estruturado:
   - Blocos por funcionalidade (ex: "Bloco 1 — Configuração")
   - IDs sequenciais (CT-01, CT-02…)
   - Casos de sucesso e casos de falha/borda
   - Checkbox de passou/falhou por caso

🔒 **Security Sênior** — Verifica: OWASP Top 10, inputs sem sanitização, variáveis de ambiente expostas, `console.log` vazando dados, autenticação/autorização, dependências vulneráveis.

✅ **Aprovador** — Valida: código faz o que foi pedido, segue o CLAUDE.md, arquivos dentro de 300 linhas, QA e Security aprovaram sem ressalvas. Para telas e fluxos, aplica obrigatoriamente a checklist de UX da seção 4 (Cognição Zero) — se qualquer critério falhar, repassa ao Dev antes de aprovar.

📝 **Documentação** — Gera automaticamente após aprovação: o que foi criado, como usar, parâmetros, exemplos. Atualiza o README.md se necessário.

### Regra #3 — Limites de arquivo

- **Nenhum arquivo pode ultrapassar 300 linhas**
- Se uma feature exigir mais: dividir em componentes/módulos menores
- `App.tsx` concentra apenas estado global e roteamento — sem lógica de negócio

### Regra #4 — Proibições absolutas

- ❌ `console.log` em qualquer arquivo (apenas `console.error` em blocos catch)
- ❌ `any` no TypeScript — tipar tudo explicitamente
- ❌ Componentes sem tratamento de loading e erro
- ❌ Chamadas Supabase fora de um bloco `try/catch/finally`
- ❌ Variáveis de ambiente hardcodadas — sempre via `.env`
- ❌ Arquivos de teste ausentes para lógica de negócio nova

### Regra #5 — Testes obrigatórios

Todo código novo que contenha lógica de negócio (services, hooks, utils, core) deve vir acompanhado de testes em `tests/`. Componentes React puros de UI são opcionais.

### Regra #6 — Comunicação com o usuário

- Ao iniciar: informar qual agente está rodando
- Ao reprovar: mostrar o feedback do agente e quantas tentativas restam
- Ao aprovar: confirmar quais agentes aprovaram antes de escrever
- Ao finalizar: listar os arquivos criados/alterados

---

## 1. Stack Obrigatória

| Camada      | Tecnologia                              |
| ----------- | --------------------------------------- |
| Frontend    | React 19 + Vite                         |
| Gráficos    | Chart.js + react-chartjs-2              |
| Linguagem   | JavaScript (sem TypeScript)             |
| Linting     | ESLint 9                                |
| Backend     | .NET 9 (C# Minimal API)                 |
| ORM         | Entity Framework Core 9 + Npgsql        |
| Banco       | Supabase (PostgreSQL)                   |

---

## 2. Estrutura de Pastas

```
meu-projeto/
├── .env                        # Nunca versionar
├── .gitignore
├── README.md                   # Sempre atualizado
├── CLAUDE.md                   # Este arquivo
├── package.json
├── vite.config.ts
├── tailwind.config.ts
├── postcss.config.js
├── tests/
└── src/
    ├── main.tsx
    ├── App.tsx                  # Estado global + roteamento apenas
    ├── index.css                # Apenas Tailwind directives
    ├── assets/
    ├── config/                  # Supabase client, variáveis de ambiente
    ├── core/                    # Regras de negócio puras
    ├── shared/
    │   ├── components/          # Componentes reutilizáveis
    │   └── hooks/               # Hooks reutilizáveis
    └── features/
        └── [feature]/
            ├── components/
            ├── services/
            └── [feature].routes.ts
```

**Regras:**

- Um componente por arquivo — nome do arquivo = nome do componente
- Subpastas apenas para módulos distintos e completos
- Estrutura flat — adicionar pastas apenas quando necessário
- Organizar por funcionalidade, não por tipo de arquivo

---

## 3. Identidade Visual

### Paleta de Cores

| Papel            | Hex       |
| ---------------- | --------- |
| Primária / Ação  | `#000000` |
| Fundo principal  | `#FFFFFF` |
| Destaque / Hover | `#1038FF` |
| Texto secundário | `#B1B6B0` |
| Fundo secundário | `#F4F4F4` |
| Bordas           | `#E2E2E2` |
| Sucesso          | `#16A34A` |
| Alerta / Perigo  | `#DC2626` |
| Informação       | `#0891B2` |
| Destaque laranja | `#EA580C` |

### Tipografia

- **Fonte:** `system-ui, -apple-system, sans-serif`
- **Font-smoothing:** sempre `antialiased`
- **Títulos:** UPPERCASE, `font-bold`, `tracking-widest`
- **Labels:** `font-semibold`, uppercase, `text-xs` a `text-sm`
- **Texto secundário:** `#B1B6B0`, peso regular

### Componentes Padrão

**Botões:**
| Tipo | Fundo | Hover |
|---|---|---|
| Primário | `#000000` texto branco uppercase | `#1038FF` |
| Secundário | `#B1B6B0` texto branco | preto |
| Admin | `#1038FF` texto branco | preto |
| Destrutivo | `#DC2626` texto branco | preto |
| Desabilitado | `#D3D3D3` texto cinza | — |

**Cards:** `border: 2px solid black`, `rounded`, `shadow-lg`

**Inputs:** fundo `#F4F4F4`, borda `#E2E2E2` 2px. Focus: borda preta, `outline: none`

**Modais:** header fundo preto + ícone Lucide + h2 uppercase bold. Backdrop `rgba(0,0,0,0.5)`

### Layout

- Mobile-first, breakpoints `md:` e `lg:`
- `max-w-6xl`, padding `p-4`
- Grid: 1 col → 2 → 4
- Gap: `gap-3` a `gap-4`

---

## 4. UX — Cognição Zero

> **Lei de Hick + cognição zero: o usuário reconhece, não pensa.**
> O design certo é aquele onde o usuário age por instinto. Quando alguém precisa entender a interface para usá-la, já falhou.

### Checklist obrigatória para telas e fluxos

| Pergunta | Meta | Como resolver se falhar |
|---|---|---|
| Quantos cliques até a ação primária? | ≤ 2 | Encurtar fluxo, eliminar confirmações desnecessárias |
| Quantas decisões ambíguas? | 0 | Hierarquia visual clara, um CTA dominante por tela |
| Segundos até agir? | < 3s | Ação primária above the fold, sem distração visual |
| Precisa ler para entender o que fazer? | Nunca | Labels óbvios, affordance clara, feedback imediato |

### Regras

**Cliques:** ≤ 2 para qualquer ação primária. Se precisar de 3+, a arquitetura está errada. O que importa não é a quantidade — é que cada clique seja óbvio.

**Decisões:** zero ambíguas. O usuário pode ter opções, mas a resposta certa precisa ser visualmente evidente. Nunca dois CTAs de peso igual na mesma tela.

**Segundos até agir:** a próxima ação deve ser visível sem scroll e sem leitura. O olho encontra, a mão clica.

**Estado do sistema:** o sistema comunica estado, destino e consequência da ação antes do clique. O usuário nunca deve se perguntar "o que vai acontecer se eu clicar aqui?"

**Teste de stress:** coloque uma pessoa real na tela e cronômetro. Se ela hesitar, está errado. Opinião não valida — observação valida.

---

## 5. Identidade Verbal

**Idioma:** Português Brasileiro
**Tom:** Direto, motivacional, sem jargão técnico

| Contexto | Padrão                                                                          |
| -------- | ------------------------------------------------------------------------------- |
| Ações    | Infinitivo: _"Selecione seu nome"_                                              |
| Sucesso  | _"✓ Exportado com sucesso!"_                                                    |
| Alertas  | _"Atenção! Esta ação irá..."_                                                   |
| Erros    | Com orientação: _"Email não autorizado. Entre em contato com o administrador."_ |
| Loading  | Gerúndio: _"Carregando..."_, _"Verificando..."_                                 |

---

## 6. Convenções de Código

### Nomenclatura de Funções

| Tipo              | Padrão             | Exemplo                         |
| ----------------- | ------------------ | ------------------------------- |
| Handler de evento | `handle` + Ação    | `handleLogin()`                 |
| Busca de dados    | `load` + Entidade  | `loadStudents()`                |
| Export            | verbo + Noun       | `exportToExcel()`               |
| Toggle/update     | verbo + Entidade   | `toggleCell()`                  |
| Utilitário        | verbo + Noun curto | `normalizeString()`, `fmtBRL()` |
| Computação        | `compute` + Noun   | `computeRecsOI()`               |

### Nomenclatura de Variáveis

| Tipo               | Padrão                                       |
| ------------------ | -------------------------------------------- |
| Componentes React  | PascalCase                                   |
| Estado             | camelCase + par Set: `[loading, setLoading]` |
| Refs               | camelCase + `Ref`: `updateQueueRef`          |
| Constantes globais | UPPER_SNAKE_CASE                             |
| Variáveis locais   | camelCase                                    |

### Clean Code — Inegociável

- Funções com **máximo 20 linhas** — extrair se ultrapassar
- **Early return** para reduzir aninhamento
- Um único nível de abstração por função
- Sem comentários óbvios — o nome se explica
- Sem `any` — tipar tudo explicitamente
- Sem `console.log` — apenas `console.error` em catch

### Padrões de Estado

```typescript
const [isAuthenticated, setIsAuthenticated] = useState(false);
const [currentUser, setCurrentUser] = useState<User | null>(null);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);
const [message, setMessage] = useState<{
  type: "success" | "error";
  text: string;
}>({ type: "", text: "" });
const [currentView, setCurrentView] = useState<
  "dashboard" | "list" | "student"
>("dashboard");
```

### Tratamento de Erros

```typescript
try {
  setLoading(true);
  const { data, error } = await supabase.from("tabela").select("*");
  if (error) throw error;
} catch (err) {
  setError(err instanceof Error ? err.message : "Erro desconhecido");
  console.error(err);
} finally {
  setLoading(false);
}
```

### Organização de Imports

```typescript
// 1. React e hooks
import React, { useState, useEffect, useRef } from "react";
// 2. UI / ícones
import { Users, LogOut } from "lucide-react";
// 3. Gráficos e utilitários
import { BarChart } from "recharts";
// 4. Supabase
import { createClient } from "@supabase/supabase-js";
// 5. Componentes locais
import AdminPanel from "./AdminPanel";
// 6. CSS
import "./index.css";
```

---

## 7. Convenções Supabase

**Tabelas:** `snake_case` plural — `alunos`, `gif_dados`, `historico_semanas`

**Colunas:** `snake_case` — booleanos `is_`, timestamps `_at`, FKs `_id`

**RPC:** `snake_case` verbo+substantivo, params com `p_` — `cadastrar_aluno(p_name, p_email)`

```typescript
// Select
const { data, error } = await supabase.from("tabela").select("*").order("name");
// Update
await supabase.from("tabela").update({ campo: valor }).eq("id", id);
// Upsert
await supabase.from("tabela").upsert({ ... }, { onConflict: "email" });
// RPC
await supabase.rpc("nome_funcao", { p_param: valor });
```

**Auth:** whitelist por `usuarios_autorizados`. Estado em `localStorage` com chave `nomeProjetoUser`.

---

## 8. Princípios da Marca

> **Minimalista, alto contraste, propositado.**

1. Bordas limpas, formas simples, sem enfeites
2. Preto/branco como base — máxima legibilidade
3. Cores semânticas: verde = sucesso, vermelho = alerta, azul = destaque
4. System fonts — sem dependências desnecessárias
5. Mobile-first como padrão
6. Loading states e feedback sempre visíveis
7. Emojis de progressão sem perder profissionalismo
