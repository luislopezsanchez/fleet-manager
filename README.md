# Fleet Manager — Sistema de Gestión y Monitoreo de Flota Vehicular

## Descripción
Plataforma de gestión de flota vehicular que se integra con la API de istarmap.com
para monitoreo en tiempo real, reportes con IA, gestión masiva de iButtons y alertas predictivas.

## Stack
- **Backend**: Python FastAPI + SQLAlchemy + asyncpg
- **Frontend**: React 18 + Vite + TypeScript + TailwindCSS + react-i18next
- **Database**: PostgreSQL 16 + PostGIS
- **Deploy**: Docker Compose en servidor 172.30.36.87

## Puertos
- Frontend: http://172.30.36.87:8090
- Backend API: http://172.30.36.87:8091
- PostgreSQL: 127.0.0.1:55434 (loopback only)

## Comandos
```bash
# Desarrollo
docker compose up -d --build

# Ver logs
docker compose logs -f backend

# Reiniciar
docker compose restart backend
```

## i18n
Multi-idioma: Español (default), English, Português.
Preferencia guardada en localStorage.