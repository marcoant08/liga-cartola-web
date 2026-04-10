# Liga Cartola — Web

Front-end em [Next.js](https://nextjs.org) para a API do repositório **liga-cartola-server** (NestJS + MongoDB).

## Pré-requisitos

- Node.js 20+
- API rodando (por padrão `http://localhost:3000`)
- MongoDB configurado no servidor

## Configuração

```bash
cp .env.local.example .env.local
```

Ajuste `NEXT_PUBLIC_API_URL` se a API não estiver em `http://localhost:3000`.

## Desenvolvimento

O app sobe na porta **3001** para não conflitar com o Nest na 3000.

```bash
npm install
npm run dev
```

Abra [http://localhost:3001](http://localhost:3001).

## Build

```bash
npm run build
npm start
```

## Funcionalidades

- Cadastro, verificação de e-mail, login (JWT access + refresh)
- Ligas: listar, criar, detalhe, entrar por convite, admin (editar, convite, convidado, remover membro, registrar rodada)
- Perfil do usuário
- Página de **estatísticas** por liga (ranking, prêmio estimado, gráficos com Recharts)

**Nota:** Se o envio de e-mail de verificação estiver desligado no servidor, use o código gravado no MongoDB ou ative o serviço de e-mail no backend.
