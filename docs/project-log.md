# Bitácora — Fleet Manager (Sistema de Gestión y Monitoreo de Flota Vehicular)

## Fecha: 2026-09-02

---

## FASE 1 — Fundación ✅ COMPLETADA
- Stack: FastAPI + React + PostgreSQL/PostGIS + Docker
- Auth JWT, roles Admin/Supervisor, CRUD de sectores
- Cliente istarmap con AES+BASE64, token cache
- i18n es/en/pt
- 40 dispositivos sincronizados desde istarmap
- Tracking en vivo: 37 posiciones GPS reales

## FASE 2 — Mapa en vivo + Reportes ✅ COMPLETADA
- DashboardPage con KPIs reales + mapa Leaflet + auto-refresh 30s
- MapPage a pantalla completa con marcadores por estado + auto-refresh 10s
- DevicesPage con datos reales, botón sync, tabla completa
- DeviceDetailPage con info + mini-mapa + historial de alertas
- ReportsPage con selector de tipo (kilometraje, alarmas, excesos, historial)
- Backend: routers/reports.py con 5 endpoints proxy a istarmap

## FASE 3 — iButtons masivos ✅ COMPLETADA
- Backend: routers/ibuttons.py con upload CSV + batch + command log
- Frontend: IButtonsPage con drag&drop CSV, preview, ejecución batch
- Comandos 144 (add), 145 (remove), 146 (approve)
- Tracking de estado: pending/sent/confirmed/failed

## FASE 4 — Alertas predictivas ✅ COMPLETADA
- Motor de alertas: services/alerts_engine.py
  - check_inactivity: detecta vehículos sin actividad ≥7 días
  - check_overspeed_alerts: detecta excesos en posiciones recientes
  - run_all_alerts: ejecuta todas las verificaciones
- Scheduler en background: ejecuta cada 1 hora automáticamente
- Router ampliado: POST /alerts/check (manual), GET /alerts/stats
- Frontend: AlertsPage con filtros, stats, botón "Verificar ahora"
- **Resultado real**: 8 alertas de inactividad detectadas al arrancar

## FASE 5 — Asistente IA conversacional ✅ COMPLETADA
- Backend: services/ai_assistant.py
  - Soporta cualquier proveedor cloud OpenAI-compatible
  - Ollama Cloud, DeepSeek, OpenAI, OpenRouter
  - Flujo: pregunta → LLM genera plan JSON → ejecuta API → LLM resume
  - 7 endpoints istarmap soportados
  - Historial en memoria (100 mensajes por usuario)
- Backend: routers/assistant.py con POST /assistant/chat + GET /assistant/history
- Frontend: AssistantPage con chat, sugerencias, cards de acciones
- Config: AI_PROVIDER, AI_API_KEY, AI_MODEL, AI_BASE_URL en .env
- NO usa Ollama local — exclusivamente cloud con API key

---

## URLs de acceso
- Frontend: http://172.30.36.87:8093
- API: http://172.30.36.87:8092
- Swagger: http://172.30.36.87:8092/docs
- DB: 127.0.0.1:55434 (loopback)

## Credenciales
- Admin: admin@fleetmanager.com / admin123
- Istarmap: Teledata / Teledata@2025 (org_id=6128)
- DB: fleet / FleetSec2026

## Configuración IA (cloud)
- AI_PROVIDER=ollama_cloud (cambiable a deepseek/openai/openrouter)
- AI_API_KEY=clave (en .env)
- AI_MODEL=qwen2.5:7b
- AI_BASE_URL=https://api.ollama.com/v1

## Datos actuales
- 40 dispositivos sincronizados
- 8 alertas de inactividad detectadas
- 2 sectores: Administracion, Planta Externa

## Contenedores
- fleet-db (PostgreSQL 16 + PostGIS) — volumen persistente
- fleet-backend (FastAPI) — puerto 8092
- fleet-frontend (React/nginx) — puerto 8093