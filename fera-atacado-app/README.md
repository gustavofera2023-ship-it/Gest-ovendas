# Fera Atacado — Aplicativo de Contatos (Cloudflare Workers + D1)

Este **não é um HTML de demonstração**. Possui TV pública, Gerencial com senha e API real com banco D1 compartilhado. Nenhum vendedor ou contato fictício é carregado. O Gerencial importa a planilha e os números aparecem na TV de outros dispositivos, com verificação automática a cada 5 segundos. Ao começar outro dia, o sistema zera os números e preserva o cadastro de vendedores.

## Arquivos

- `public/index.html`: interface aprovada (TV + Gerencial) e animações.
- `src/worker.js`: servidor, autenticação e lançamentos com banco compartilhado.
- `migrations/0001_init.sql`: tabelas do D1; executar apenas uma vez.
- `wrangler.toml`: nome do Worker, assets e ligação com o banco.
- `package.json`: comandos de publicação.

## Configurar e publicar no Cloudflare

### 1. Criar o banco de dados

No painel Cloudflare, abra **Storage & databases → D1 SQL database → Create database**. Nome: `fera-contatos`.

Copie o **Database ID** (identificador UUID, com hífens).

Abra `wrangler.toml` no repositório GitHub e substitua APENAS o texto `SUBSTITUA_PELO_ID_DO_SEU_BANCO_D1` pelo identificador obtido. O binding precisa ficar como `DB`.

No banco recém-criado, abra **Console** e execute uma única vez o conteúdo de `migrations/0001_init.sql`. Alternativamente, use a ferramenta Wrangler:

```bash
npx wrangler d1 migrations apply fera-contatos --remote
```

### 2. Configurar a senha do Gerencial com segurança

No Worker `gest-ovendas`, abra **Settings → Variables and Secrets** e adicione **dois secrets**:

- `ADMIN_PASSWORD`: senha privada forte, com no mínimo 12 caracteres.
- `SESSION_SECRET`: texto aleatório privado com no mínimo 32 caracteres, diferente da senha.

Use **Secret** (criptografado), nunca variável pública e **NUNCA** salve esses valores no GitHub. O Worker recusará consultas até ambos existirem.

### 3. Atualizar o repositório ligado à Cloudflare

No GitHub, abra o repositório que já está conectado ao Worker `gest-ovendas`. Na raiz do repositório, envie **os arquivos e pastas extraídos** deste ZIP: `public/`, `src/`, `migrations/`, `wrangler.toml`, `package.json` e `README.md`. **Não envie o ZIP inteiro como um único arquivo.**

Confira que `public/index.html` está visível no GitHub e que `src/worker.js` também está. Apague o projeto demo anterior se estiver substituindo esta mesma implantação; não mantenha dois `wrangler` conflitantes.

A Cloudflare deve implantar pela integração com Git. Se pedir um comando para deploy, informe `npx wrangler deploy` (ou `npm run deploy`). O projeto não requer build de frontend.

### 4. Conferir os dois endereços

**TV:** `https://gest-ovendas.gustavofera2023.workers.dev/?view=tv`

**Gerencial:** `https://gest-ovendas.gustavofera2023.workers.dev/?view=admin`

No Gerencial, digite a senha do secret `ADMIN_PASSWORD` e importe uma planilha Excel ou CSV com cabeçalhos `Vendedor`, `WhatsApp`, `Attender` e `Vivo Digital` (a coluna `Data` é opcional e informativa). Os dados passam a valer para a data atual do servidor, em `America/Sao_Paulo`.

Abra o link TV **em outro aparelho** e lance um contato no Gerencial. Em até cerca de 5 segundos, a TV deve consultar o novo total. A faixa móvel e a rotação dos rankings permanecem automáticas.

## Segurança e limitações

- A TV é **pública**: qualquer pessoa com o link vê nomes dos vendedores e totais de contatos. Compartilhe o endereço de forma consciente.
- O Gerencial precisa de senha; possuir o link sozinho **não autoriza modificações**.
- Autenticação usa cookie `HttpOnly`, `Secure`, `SameSite=Strict`, assinado e válido por 6 horas. Tentativas de senha errada são limitadas por IP.
- Os totais antigos e os lançamentos anteriores são apagados na primeira consulta depois da mudança de dia em São Paulo. Os nomes permanecem.
- A importação substitui o cadastro e os totais atuais; confira o arquivo antes de confirmar.
- Arquivos Excel utilizam biblioteca obtida no jsDelivr; se indisponível, exporte a planilha como CSV.
- Para acesso e sincronização online, é obrigatório implantar **o Worker com D1**, e não somente `public/index.html` em hospedagem estática.
- O projeto foi testado localmente com uma API simulando D1 e verificação de sintaxe. **A implantação no seu ambiente Cloudflare depende da configuração acima e ainda precisa ser conferida depois.**

Documentação oficial: https://developers.cloudflare.com/d1/get-started/ e https://developers.cloudflare.com/workers/static-assets/binding/.
