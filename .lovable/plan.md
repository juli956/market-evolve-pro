
# Evolución del Gestor de Ventas → React (TanStack Start)

Elegiste "portar a React manteniendo el look" y "sin datos previos a migrar". Bajo esa base, este es el plan. Vamos a construir por etapas, verificando después de cada una antes de seguir.

## Principios

- **Mantener la interfaz**: mismos tabs (Dashboard, Nueva Venta, Productos, Historial, Métricas), misma paleta (indigo/violeta/verde/naranja sobre gris claro), mismos íconos emoji, mismos flujos. Refino spacing/sombras/estados, no rediseño.
- **Código modular**: cada dominio en su carpeta (`sales/`, `products/`, `clients/`, `providers/`, `dashboard/`, `backup/`). Nada de un único archivo gigante.
- **Compatibilidad de datos**: al arrancar, el frontend detecta `gp_products` y `gp_sales` en `localStorage` y los importa automáticamente al store nuevo (y luego a Supabase cuando activemos Etapa 3). Nunca se sobreescribe si ya se importó.
- **Sin romper lo existente**: cada etapa agrega, no quita. Todas las funciones actuales (calcular venta, exportar Excel/CSV/Resumen, editar producto, ver stock) se preservan.
- **UI moderna**: `shadcn/ui` + `sonner` para toasts, `Recharts` para gráficos, `date-fns` para fechas. Sin `alert()` — todos los diálogos son modales.

## Etapas

### Etapa 0 – Base (obligatoria, primera entrega)
- Layout con tabs, tema con los colores actuales como tokens semánticos en `styles.css`.
- Store local (Zustand + persist) con `products`, `sales`, más la migración automática desde `gp_products`/`gp_sales`.
- Portar exactamente: Dashboard actual, Nueva Venta, Productos (CRUD + modal), Historial básico, Métricas, exportar Excel/CSV/Resumen.

### Etapa 1 – Historial mejorado
- Editar venta completa (cliente, fecha, ítems, cantidades, precio, costo → recalcula ganancia).
- Eliminar con confirmación (AlertDialog).
- Filtros: Desde, Hasta, Cliente, Producto (combinables).
- Búsqueda instantánea (cliente/producto, debounced).
- Ordenamiento por Fecha / Monto / Ganancia / Cliente asc-desc.
- Modal de detalle con Cliente, Fecha, Ítems (cant, costo, precio, ganancia, margen), Total, Ganancia, Margen global.

### Etapa 2 – Respaldos
- "Crear respaldo": descarga `gestor-ventas-YYYYMMDD-HHmm.json` con `{version, products, sales, clients, providers, settings}`.
- "Restaurar respaldo": selector de archivo, valida `version`, confirma, reemplaza el store.
- Respaldo automático: guarda snapshot en `localStorage` diario (últimos 7); botón "Descargar último automático".

### Etapa 3 – Supabase (Lovable Cloud) + sync
- Enciendo Lovable Cloud.
- Auth: email/password + Google.
- Tablas: `products`, `sales`, `sale_items`, `clients`, `providers`, `product_cost_history`, `user_roles`. Cada una con RLS por `user_id = auth.uid()` y GRANTs.
- Al loguearse por primera vez, el store local se **sube** a Supabase (una sola vez). Después, Supabase es la fuente de verdad; el store local queda como caché.
- Realtime: suscripciones a cambios en `sales`/`products` → sync PC ↔ celular en vivo.

### Etapa 4 – Dashboard profesional
- KPIs: Hoy / Semana / Mes / Año, con delta % vs período anterior.
- Gráficos (Recharts): ventas por día (últimos 30), ganancia mensual (últimos 12), top productos, top clientes.
- Cards: Ticket promedio, Rentabilidad, Ganancia diaria/mensual.

### Etapa 5 – Clientes
- Sección nueva. Campos: nombre, teléfono, observaciones.
- Derivados desde `sales`: cantidad de compras, última compra, total gastado, ganancia generada.
- Vinculación automática al crear venta (autocomplete por nombre).

### Etapa 6 – Proveedores + historial de costos
- Sección nueva. Cada producto asociable a un proveedor.
- Al cambiar el costo de un producto se registra en `product_cost_history` (costo, fecha, variación %).
- En la ficha del producto: último costo, promedio, timeline de cambios.

### Etapa 7 – Productos mejorados
- Historial de aumentos (ya cubierto por Etapa 6).
- Stock mínimo por producto + alerta visual (badge rojo) y sección "Stock bajo" en Dashboard.
- Duplicar producto.
- Importar productos (CSV/JSON) y exportar productos (CSV/JSON).

### Etapa 8 – Ventas mejoradas
- Duplicar venta.
- Imprimir venta (vista print-friendly).
- Exportar PDF (jsPDF + autotable).
- Notas / observaciones por venta.
- Forma de pago: efectivo, transferencia, Mercado Pago, cuenta corriente, cheque.

### Etapa 9 – Estadísticas avanzadas
- Producto más rentable, cliente que más compra, proveedor más usado.
- Ventas por día/semana/mes, ganancias acumuladas, historial anual con gráfico de evolución.

### Etapa 10 – PWA
- `vite-plugin-pwa` con manifest, íconos, `NetworkFirst` para navegaciones, `CacheFirst` para assets hasheados.
- Instalable en Android/iOS/PC. Registro guardado sólo en producción (no en preview de Lovable).

## Detalle técnico (para referencia)

- Stack fijo del proyecto: React 19 + TanStack Start + Tailwind v4. No se puede cambiar.
- Estado: `zustand` + `persist` (localStorage) en Etapas 0-2; en Etapa 3 se mueve a `@tanstack/react-query` sobre Supabase, con el store local como caché offline.
- Tipos compartidos en `src/lib/types.ts`. Migración `gp_products`/`gp_sales` en `src/lib/legacy-migration.ts` (idempotente vía flag `gp_migrated_v1`).
- Ruteo: una sola ruta `/` con tabs en Etapas 0-2; en Etapa 3+ paso a rutas anidadas bajo `_authenticated/` (dashboard, sales, products, clients, providers, history, settings) más `/auth` público.
- Exportaciones actuales (Excel/CSV/Resumen) portadas con `xlsx` y `file-saver`, misma lógica.

## Primera entrega propuesta

Hago **Etapa 0 + Etapa 1 + Etapa 2** en esta iteración (base + historial completo + respaldos). Verifico y screenshoteo. Después decidís si seguimos con Supabase (Etapa 3) o priorizás otra.

¿Aprobás así o querés cambiar la primera entrega (por ejemplo: sólo Etapa 0, o incluir Etapa 3 desde ya)?
