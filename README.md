# Sistema SEMED - Atividades e Oficinas

Sistema web para inscricoes, gestao de atividades/oficinas, frequencia, relatorios e usuarios.

## Estrutura

- `index.html`: interface principal.
- `app.js`: controles da interface.
- `supabase-init.js`: camada de dados no Supabase.
- `supabase.sql`: criacao da tabela no Supabase.
- `.github/workflows/pages-deploy.yml`: publicacao no GitHub Pages.

## Configuracao no GitHub

Em `Settings > Pages`, selecione:

```text
Build and deployment: GitHub Actions
```

Em `Settings > Secrets and variables > Actions`, crie:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

Valores atuais:

```text
NEXT_PUBLIC_SUPABASE_URL=https://fcijhxqdfpykdsnbkatw.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_7w3w4Z3ytdAtNHdfqYUz7A_XQVludqR
```

## Configuracao no Supabase

No `SQL Editor`, execute o conteudo de:

```text
supabase.sql
```

Se aparecer `TypeError: Failed to fetch`, confira:

- o projeto Supabase esta ativo em `https://fcijhxqdfpykdsnbkatw.supabase.co`;
- os dois secrets do GitHub estao cadastrados exatamente com os nomes acima;
- o workflow `Publicar GitHub Pages` foi executado depois de alterar os secrets;
- o arquivo `supabase.sql` foi executado no SQL Editor do Supabase.

## Login inicial

```text
E-mail: admin@semed.local
Senha: adm123
```
