# Fera Atacado — Painel de Contatos

Demonstração interativa com duas telas:

- **TV**: indicadores, pódio, faixa de vendedores em movimento e ranking paginado.
- **Gerencial**: lançamentos rápidos de contatos, cadastro/edição de vendedores, importação de CSV/XLSX e configurações.

## Publicar pelo GitHub e pela Netlify

1. Crie um repositório no GitHub (por exemplo, `painel-fera-atacado`).
2. Envie `index.html`, `netlify.toml` e `README.md` para a raiz do repositório. **Não** envie o ZIP diretamente: o GitHub não o descompacta.
3. Na Netlify, acesse **Add new project → Import an existing project**, selecione **GitHub** e escolha o repositório.
4. Use a branch `main`. Publicação na raiz (`.`). Não é necessário comando de build. Clique em **Deploy/Publish**.
5. Após a publicação, teste:
   - `https://SEU-SITE.netlify.app/?view=tv`
   - `https://SEU-SITE.netlify.app/?view=admin`

## Atenção: é uma demonstração, não um sistema de produção

- Os dados ficam no `localStorage` do navegador em que foram registrados.
- Abas do mesmo site/perfil de navegador podem compartilhar os mesmos dados; computadores diferentes **não** sincronizam.
- A área Gerencial **não tem autenticação**; qualquer pessoa com acesso ao site pode abri-la.
- Os dados de exemplo são fictícios.
- A importação de Excel carrega a biblioteca SheetJS de um CDN quando necessária.
- Para uso real com TV em outro dispositivo e acesso gerencial controlado, será preciso implementar backend, armazenamento central e controle de acesso.
