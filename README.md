# Gelocrim React App

Frontend React do sistema de roteirização Gelocrim.

## Estrutura

```
src/
  components/    # Componentes reutilizáveis (Layout, etc)
  pages/         # Páginas da aplicação
  services/      # API e serviços externos
  context/       # Contextos React (Auth, etc)
  hooks/         # Hooks customizados
```

## Instalação local

```bash
npm install
cp .env.example .env
npm start
```

## Deploy no Vercel

1. Crie conta em https://vercel.com
2. Conecte ao GitHub
3. Importe este repositório
4. Configure variáveis de ambiente:
   - REACT_APP_API_URL=https://gelocrim-backend-production.up.railway.app/api/v1
   - REACT_APP_GMAPS_KEY=AIzaSyB47DpEZW4qbU74LxcG1ZD76cYLRlJw88M
5. Deploy automático!

## Telas implementadas

- ✅ Login
- ✅ Dashboard
- ✅ Pedidos
- ✅ Equipe de Entrega
- 🚧 Roteirização Visual (em desenvolvimento)
- 🚧 Conferência Master (em desenvolvimento)
- 🚧 Monitoramento (em desenvolvimento)
- 🚧 Veículos (em desenvolvimento)
- 🚧 Parceiros (em desenvolvimento)
- 🚧 Produção (em desenvolvimento)
- 🚧 Relatórios (em desenvolvimento)

## Backend

API: https://gelocrim-backend-production.up.railway.app
