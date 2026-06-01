# Configuracao GitHub Pages + Supabase

1. No Supabase, execute `supabase.sql` no SQL Editor.
2. No GitHub, cadastre os secrets:

```text
NEXT_PUBLIC_SUPABASE_URL=https://fcijhxqdfpykdsnbkatw.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_7w3w4Z3ytdAtNHdfqYUz7A_XQVludqR
```

3. Em `Settings > Pages`, selecione `GitHub Actions`.
4. Rode o workflow `Publicar GitHub Pages`.

Se o login mostrar `Nao foi possivel acessar o Supabase`, abra a pagina publicada e confirme no DevTools > Network se a chamada para `https://fcijhxqdfpykdsnbkatw.supabase.co` esta liberada. Se o projeto estiver pausado ou os secrets estiverem antigos, o navegador retornara `Failed to fetch`.

Login inicial:

```text
admin@semed.local
adm123
```
