# Migração SQLite → Supabase

## Pré-requisitos

- `sqlite3` instalado na máquina
- Acesso ao SQL Editor do Supabase

## Passo 1 — Exportar os dados do SQLite

Execute cada bloco no terminal (ajuste o caminho do `.db` se necessário):

```bash
# Exportar cada tabela como CSV
sqlite3 -header -csv controle-ganhos.db "SELECT * FROM Transportadoras;"      > transportadoras.csv
sqlite3 -header -csv controle-ganhos.db "SELECT * FROM Rotas;"                > rotas.csv
sqlite3 -header -csv controle-ganhos.db "SELECT * FROM Pnrs;"                 > pnrs.csv
sqlite3 -header -csv controle-ganhos.db "SELECT * FROM PaymentSchedules;"     > payment_schedules.csv
sqlite3 -header -csv controle-ganhos.db "SELECT * FROM Payments;"             > payments.csv
```

## Passo 2 — Criar o schema no Supabase

No painel do Supabase: **SQL Editor → New query**, cole e execute o conteúdo de `supabase/schema.sql`.

## Passo 3 — Importar os dados

### Via Supabase Dashboard

Em **Table Editor**, selecione cada tabela e use o botão **Import data from CSV** na ordem abaixo (respeitar a ordem por causa das FKs):

1. `Transportadoras`
2. `PaymentSchedules`
3. `Rotas`
4. `Pnrs`
5. `Payments`

### Via SQL (alternativa)

Ou gere INSERTs com o sqlite3 e cole no SQL Editor:

```bash
sqlite3 controle-ganhos.db ".mode insert Transportadoras" ".output transportadoras_insert.sql" "SELECT * FROM Transportadoras;" ".quit"
```

Repita para cada tabela na mesma ordem.

## Passo 4 — Ajustar as sequences

Após importar, as sequences dos IDs precisam ser atualizadas para não conflitar:

```sql
SELECT setval(pg_get_serial_sequence('"Transportadoras"', 'Id'), MAX("Id")) FROM "Transportadoras";
SELECT setval(pg_get_serial_sequence('"Rotas"', 'Id'),           MAX("Id")) FROM "Rotas";
SELECT setval(pg_get_serial_sequence('"Pnrs"', 'Id'),            MAX("Id")) FROM "Pnrs";
SELECT setval(pg_get_serial_sequence('"PaymentSchedules"', 'Id'),MAX("Id")) FROM "PaymentSchedules";
SELECT setval(pg_get_serial_sequence('"Payments"', 'Id'),        MAX("Id")) FROM "Payments";
```

Execute no SQL Editor do Supabase.

## Passo 5 — Configurar o backend

Em `backend/Api/appsettings.Development.json`, substitua os placeholders pela connection string real.

Disponível em: **Supabase → Project Settings → Database → Connection string → URI**

Formato esperado:
```
Host=db.SEU_PROJECT_REF.supabase.co;Port=5432;Database=postgres;Username=postgres;Password=SUA_SENHA;SSL Mode=Require;Trust Server Certificate=true
```
