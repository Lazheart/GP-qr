# Implementación del control de acceso privado y flujo de invitaciones en GPQR

## 1. Contexto del proyecto

GPQR es una aplicación de gestión de eventos y control de asistencia mediante códigos QR, desarrollada con:

- Next.js para el frontend y backend.
- Vercel para el despliegue.
- Supabase PostgreSQL como base de datos.
- Supabase Auth para la autenticación de usuarios.

Existe un script SQL actualizado que define la estructura de la base de datos y las políticas de seguridad. Debes revisar ese script junto con el código actual del repositorio antes de realizar cambios.

## 2. Reglas de negocio obligatorias

Todos los eventos son privados. No existen eventos públicos.

Hay tres actores principales:

### Creador del evento

Es un usuario registrado que crea y administra sus propios eventos.

Puede:
- Crear, consultar, actualizar y gestionar sus eventos.
- Registrar invitados y consultar la lista completa de invitados.
- Consultar los datos personales de sus invitados.
- Generar, revocar y gestionar los códigos QR.
- Invitar usuarios registrados como validadores mediante correo electrónico.
- Revocar invitaciones pendientes y retirar validadores autorizados.
- Consultar y gestionar los registros de asistencia.
- Exportar la lista de asistentes a Excel.

### Validador

Es un usuario registrado de GPQR que recibe una invitación por correo para validar entradas de un evento específico.

Puede:
- Aceptar una invitación dirigida a su correo.
- Consultar los eventos en los que tiene autorización activa.
- Consultar la información de los invitados del evento autorizado que sea necesaria para la validación.
- Escanear QR y registrar asistencias.
- Consultar el estado de una invitación o asistencia cuando corresponda.

No puede:
- Acceder a eventos de otros usuarios sin autorización.
- Asignarse permisos a sí mismo.
- Invitar o retirar otros validadores, salvo que se defina expresamente esa facultad.
- Modificar la configuración del evento ni administrar los invitados, excepto las operaciones que se autoricen expresamente.

### Invitado

Es la persona registrada como participante de un evento. No necesita tener una cuenta de GPQR.

Puede:
- Recibir su invitación y su código QR individual.
- Consultar únicamente la información mínima de su propia invitación, si se habilita un enlace de consulta.
- Presentar el QR para verificar su identidad o invitación.

No puede:
- Consultar la lista total de invitados.
- Consultar datos personales de otros participantes.
- Acceder al panel administrativo del evento.
- Registrar o revocar asistencias.
- Utilizar el QR para obtener acceso a las tablas de la base de datos.

## 3. Objetivo principal

Completar la implementación real de estas reglas en el proyecto existente. No basta con ocultar opciones en la interfaz: los permisos deben verificarse en el servidor y en Supabase mediante Row Level Security (RLS).

No rehagas el proyecto desde cero. Reutiliza la arquitectura, los componentes, las tablas y las funciones existentes siempre que sean compatibles con estas reglas.

## 4. Tareas de implementación

### Fase 1. Auditoría del proyecto

1. Inspecciona la estructura del repositorio.
2. Identifica las rutas, componentes, Server Actions, Route Handlers, servicios y consultas de Supabase relacionados con:
   - Eventos.
   - Invitaciones.
   - Invitados.
   - Códigos QR.
   - Validadores.
   - Asistencia.
   - Exportación de datos.
3. Revisa el script SQL actualizado y compáralo con el esquema real de Supabase.
4. Identifica las funcionalidades que ya están implementadas y las que faltan.
5. Busca cualquier consulta o endpoint que permita acceder a eventos o invitados sin verificar permisos.
6. Presenta un breve diagnóstico antes de introducir cambios importantes.

No asumas que el script SQL está libre de errores. Verifica su sintaxis, coherencia con el esquema actual y seguridad.

### Fase 2. Corregir y consolidar la seguridad de la base de datos

Revisa las políticas RLS de todas las tablas relacionadas con eventos e invitados.

Asegura que:

- No exista acceso anónimo a eventos, participantes, invitaciones, registros de asistencia ni datos personales.
- El creador pueda consultar y administrar sus propios eventos.
- Los validadores activos puedan consultar únicamente los eventos a los que están asignados.
- Los validadores puedan consultar los invitados y los registros de asistencia de sus eventos autorizados.
- Un usuario no pueda modificar `created_by`, `assigned_by`, `registered_by` u otros campos sensibles para obtener permisos.
- Un usuario no pueda asignarse como validador modificando directamente una petición.
- La revocación de un validador elimine inmediatamente su acceso a las operaciones protegidas.
- Los datos históricos mantengan las mismas restricciones de acceso que los eventos originales.
- Las operaciones administrativas se ejecuten exclusivamente con permisos verificados en el servidor.

Comprueba también los permisos SQL (`GRANT` y `REVOKE`) y el comportamiento de las funciones `SECURITY DEFINER`.

Si encuentras errores en el script SQL, genera una migración correctiva compatible con el esquema existente. No elimines ni recrees tablas con datos reales sin autorización.

### Fase 3. Implementar invitaciones de validadores por correo

Completa el flujo de invitación:

1. El creador introduce el correo del validador.
2. El servidor comprueba que el usuario autenticado es propietario del evento.
3. Se crea una invitación vinculada al evento, al correo y al creador.
4. Se genera un token seguro, aleatorio, de un solo uso y con vencimiento.
5. Se envía un correo con un enlace HTTPS para aceptar la invitación.
6. El usuario abre el enlace e inicia sesión o se registra en GPQR.
7. Se verifica que el correo autenticado coincida con el destinatario de la invitación.
8. El servidor acepta la invitación y crea o activa la asignación del validador.
9. El usuario obtiene acceso únicamente al evento correspondiente.

Implementa también:

- Reenvío controlado de invitaciones.
- Revocación de invitaciones pendientes.
- Retirada de validadores ya autorizados.
- Manejo de invitaciones expiradas, revocadas o previamente aceptadas.
- Protección contra la reutilización de tokens.
- Restricciones para evitar asignaciones duplicadas.
- Mensajes de error claros sin revelar información privada innecesaria.

Utiliza el proveedor de correo y las variables de entorno que ya existan en el proyecto. Si no hay proveedor configurado, implementa la integración de manera modular y documenta las variables que se necesitan.

Nunca incluyas secretos, claves de servicio ni tokens administrativos en el frontend.

### Fase 4. Gestión de invitados y generación de QR

Completa el flujo de registro de invitados:

1. El creador registra a un invitado.
2. El servidor valida los datos y comprueba sus permisos sobre el evento.
3. Se genera un identificador QR individual y no predecible.
4. Se entrega el QR al invitado mediante el mecanismo de comunicación definido en el proyecto.
5. El QR permite identificar la invitación, pero no concede acceso a la lista de invitados ni a información personal completa.
6. El creador puede revocar la invitación o invalidar el QR.
7. Un QR revocado, inexistente o perteneciente a una invitación cancelada debe rechazarse.

Revisa el uso de `qr_token` y determina si el QR actual es suficiente para este flujo. Si se utiliza un UUID como token portador, evita exponerlo en registros, URLs públicas innecesarias o mensajes de error.

No muestres documentos de identidad, teléfonos, correos ni otros datos sensibles dentro del propio código QR.

### Fase 5. Validación de asistencia

Completa la integración con la función `scan_event_qr` o su equivalente existente.

Al escanear un QR, el servidor debe comprobar:

- Que el usuario esté autenticado.
- Que sea el creador o un validador activo del evento.
- Que el evento corresponda al QR.
- Que la invitación exista y no esté revocada o cancelada.
- Que el evento permita registrar asistencias.
- Que el invitado no tenga ya una asistencia registrada.

La actualización de asistencia debe ser atómica para impedir que dos escaneos simultáneos registren la misma entrada dos veces.

La respuesta para el validador debe mostrar únicamente los datos necesarios para confirmar la invitación y su estado. No debe permitir consultar otros invitados mediante la manipulación de parámetros.

Registra los resultados de validación y los rechazos de forma segura, sin guardar tokens QR completos en los logs.

### Fase 6. Interfaz de usuario

Adapta la interfaz existente para reflejar los permisos reales:

- El creador ve sus eventos y las herramientas de administración.
- El validador ve los eventos en los que está autorizado y la herramienta de escaneo.
- El invitado no necesita acceder al panel administrativo.
- Los eventos no deben aparecer en listados públicos ni en páginas indexables.
- Las páginas privadas deben verificar la sesión y los permisos en el servidor.
- Los errores de autorización deben mostrarse correctamente, sin exponer información de otros eventos.

No confíes exclusivamente en la navegación, los botones ocultos o las comprobaciones del cliente para garantizar la seguridad.

### Fase 7. Exportación a Excel

Comprueba la funcionalidad existente de exportación e impleméntala si falta.

El creador y los validadores autorizados deben poder exportar la información permitida de su evento, incluyendo la lista de asistentes y su estado de asistencia.

Requisitos:

- Filtrar siempre por el evento autorizado.
- Verificar permisos en el servidor antes de generar el archivo.
- No permitir exportaciones de eventos ajenos modificando el identificador.
- Evitar fórmulas maliciosas en celdas provenientes de datos de usuarios.
- No incluir secretos, tokens QR ni información innecesaria.
- Conservar la funcionalidad de exportación del historial si ya existe.

### Fase 8. Archivo histórico automático

El proyecto contempla archivar los datos una semana después de finalizar el evento.

Verifica que el mecanismo de ejecución automática esté realmente configurado en Supabase Cron o Vercel Cron.

Comprueba que:

- Solo se archiven eventos elegibles.
- La tarea sea idempotente.
- Los datos históricos conserven sus permisos.
- No se permita invocar la función de archivo desde el navegador.
- Se mantenga la integridad entre eventos, invitados y asistencias.

Si la tarea programada no existe, impleméntala con el mecanismo más compatible con la arquitectura actual y documenta su configuración.

### Fase 9. Pruebas y verificación

Añade pruebas para los siguientes escenarios:

1. Un usuario no autenticado intenta consultar un evento.
2. Un usuario autenticado intenta consultar un evento ajeno.
3. El creador consulta su propio evento y su lista de invitados.
4. Un validador autorizado consulta su evento y valida un QR.
5. Un validador intenta acceder a otro evento.
6. Un usuario intenta asignarse permisos de validador.
7. Una invitación se acepta desde una cuenta con un correo diferente.
8. Se intenta aceptar una invitación revocada o expirada.
9. Se intenta reutilizar una invitación aceptada.
10. Un QR inválido, cancelado o revocado es escaneado.
11. Dos validadores escanean simultáneamente el mismo QR.
12. Un usuario intenta consultar datos de invitados mediante un endpoint o consulta directa a Supabase.
13. Un validador revocado intenta continuar utilizando el acceso anterior.
14. Un usuario intenta exportar asistentes de un evento ajeno.
15. Se intenta ejecutar el archivado desde una sesión normal de usuario.

Ejecuta las pruebas automatizadas, las comprobaciones de tipos, el lint y la compilación disponibles en el repositorio. No afirmes que una prueba ha pasado si no la has ejecutado.

## 5. Restricciones técnicas

- Conserva Next.js, Vercel, Supabase y la estructura existente.
- No introduzcas acceso público a eventos.
- No almacenes contraseñas manualmente ni crees un sistema de autenticación paralelo a Supabase Auth.
- No expongas `service_role` ni otros secretos al cliente.
- No utilices permisos globales para resolver problemas de acceso específicos.
- Evita duplicar tablas o funciones cuando ya exista una implementación equivalente.
- Utiliza migraciones SQL versionadas para los cambios de base de datos.
- Mantén los nombres y convenciones existentes cuando sea posible.
- No elimines datos reales para facilitar una migración.
- Si falta una decisión de negocio imprescindible, explica el problema y adopta una solución conservadora, documentándola.

## 6. Entregables

Al terminar, proporciona:

1. Resumen de los problemas encontrados.
2. Lista de archivos modificados y creados.
3. Migraciones SQL implementadas.
4. Descripción del flujo de invitación por correo.
5. Descripción de la entrega y validación de QR.
6. Lista de políticas RLS corregidas o añadidas.
7. Resultado real de las pruebas ejecutadas.
8. Variables de entorno y configuración externa necesarias.
9. Instrucciones para desplegar los cambios en Vercel y Supabase.
10. Lista de tareas pendientes que no se hayan podido completar.

## 7. Criterio de finalización

La implementación se considera completa cuando:

- Todos los eventos son privados.
- Solo el creador y los validadores autorizados pueden acceder a la información de los invitados de cada evento.
- Los validadores solo obtienen acceso tras una aceptación válida de su invitación.
- Los invitados solo reciben acceso a su propia invitación y QR, sin acceso a los datos de otros participantes.
- La asistencia se registra de forma segura y sin duplicados.
- Las exportaciones y el historial respetan los permisos.
- Las pruebas de acceso no autorizado demuestran que un usuario no puede consultar ni modificar información de eventos ajenos.

Trabaja sobre el código real del repositorio. Implementa los cambios, prueba lo que sea posible y documenta con precisión cualquier limitación. No te limites a entregar un plan o ejemplos de código: realiza las modificaciones necesarias en el proyecto.