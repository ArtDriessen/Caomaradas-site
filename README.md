# Site do Hotel/Creche para Cães

Site em **Node.js (Express + EJS + MySQL)** com:

- Página inicial (serviços, como funciona, contato por WhatsApp)
- Páginas de serviço `/servicos/hotel` e `/servicos/creche` (preços, requisitos, passo a passo e perguntas frequentes)
- **Pré-reserva do hotel** (`/agendar`) e **agendamento de avaliação** para a creche (`/avaliacao`), com porte, raça, castração, idade, sociabilidade e vacinas
- Painel administrativo em `/admin` (ver pedidos, confirmar/cancelar, anotações internas, excluir)
- Botão flutuante de WhatsApp e formulário de contato que abre o WhatsApp com a mensagem pronta

## Folders e fotos

- Day use com agendamento, creche só com agendamento de avaliação, hotel com vários cães e valor total por diárias, mapa do Google no fim das páginas.
- Fotos em `public/img/` (cães enviados pela Cãomaradas): `card-*`, `hero-*`, `cta-*` e `g-*` (galeria da home). Para trocar, substitua o arquivo mantendo o nome e a proporção.

## Estrutura

```
server.js            -> ponto de entrada (Hostinger executa este arquivo)
src/config.js        -> variáveis de ambiente e dados do site
src/db.js            -> conexão MySQL e criação automática da tabela
src/auth.js          -> login do admin (cookie assinado)
src/labels.js        -> textos de porte, status etc.
src/routes/          -> rotas públicas e do admin
views/               -> páginas EJS
public/css/style.css -> visual (paleta no topo do arquivo)
public/js/app.js     -> menu mobile, formulário de WhatsApp, datas
public/img/          -> coloque aqui logo.png (usada automaticamente)
```

## Personalizar com a identidade do hotel

1. **Logo:** salve em `public/img/logo.png` (também aceita `.svg`, `.webp`, `.jpg`). O site passa a usá-la sozinho.
2. **Cores:** edite as variáveis `--primary`, `--accent`, `--bg` no início de `public/css/style.css`.
3. **Textos:** nome, slogan, WhatsApp, Instagram e endereço vêm das variáveis de ambiente (`.env.example`). Textos das seções estão em `views/index.ejs`.
4. **Portes (faixas de peso) e opções de sociabilidade:** `src/labels.js`.

## Rodar no seu computador

Precisa de Node 20.6+ e de um MySQL local.

```bash
npm install
cp .env.example .env     # preencha os dados
npm run dev
```

Acesse http://localhost:3000 e http://localhost:3000/admin

## Publicar na Hostinger via GitHub

1. Crie um repositório no GitHub e envie esta pasta:
   ```bash
   git init
   git add .
   git commit -m "Primeira versão do site"
   git branch -M main
   git remote add origin https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
   git push -u origin main
   ```
2. No **hPanel → Bancos de dados MySQL**, crie um banco e um usuário. Anote nome, usuário e senha.
3. No hPanel, crie o app **Node.js** importando o repositório do GitHub (branch `main`).
   - Framework: Express.js
   - Arquivo de entrada: `server.js`
   - Comando de instalação: `npm install` · Comando de start: `npm start`
4. Nas **variáveis de ambiente** do app, cadastre tudo do `.env.example` (em especial `DB_*`, `ADMIN_*`, `SESSION_SECRET`, `WHATSAPP_NUMBER`). Use `DB_HOST=127.0.0.1`.
5. Faça o deploy. A tabela `bookings` é criada automaticamente no primeiro start.
6. Conecte o seu domínio no hPanel e ative o SSL.
7. Teste: faça um agendamento em `/agendar` e confirme que ele aparece em `/admin`.

Depois disso, cada `git push` na branch `main` publica a atualização automaticamente.

## Segurança

- Nunca suba o arquivo `.env` (já está no `.gitignore`).
- Use uma `ADMIN_PASSWORD` forte e um `SESSION_SECRET` longo e aleatório.
- O login do admin bloqueia o IP por 15 minutos após 5 tentativas erradas.
