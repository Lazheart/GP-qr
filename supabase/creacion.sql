-- =============================================================
-- SISTEMA MULTIUSUARIO DE ASISTENCIA POR QR
-- Next.js + Vercel + Supabase (PostgreSQL + Supabase Auth)
-- Ejecutar una sola vez en un proyecto Supabase NUEVO.
-- =============================================================

begin;

create extension if not exists pgcrypto;

-- -------------------------------------------------------------
-- 1. EVENTOS
-- Cualquier usuario autenticado puede crear sus propios eventos.
-- created_by identifica al propietario del evento.
-- -------------------------------------------------------------
create table public.events (
    id uuid primary key default gen_random_uuid(),
    created_by uuid not null default auth.uid()
        references auth.users(id) on delete restrict,
    name text not null,
    description text,
    location text,
    starts_at timestamptz not null,
    ends_at timestamptz not null,
    status text not null default 'draft'
        check (status in ('draft', 'open', 'closed', 'cancelled')),
    archived_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint events_name_not_empty check (char_length(trim(name)) > 0),
    constraint events_valid_dates check (ends_at >= starts_at)
);

create index events_created_by_idx on public.events(created_by);
create index events_status_idx on public.events(status);
create index events_ends_at_idx on public.events(ends_at);

-- -------------------------------------------------------------
-- 2. PERSONAL AUTORIZADO PARA CADA EVENTO
-- Solo el creador del evento puede designar o retirar escaneadores.
-- El usuario designado debe existir en Supabase Auth.
-- -------------------------------------------------------------
create table public.event_members (
    id uuid primary key default gen_random_uuid(),
    event_id uuid not null references public.events(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    role text not null default 'scanner'
        check (role in ('scanner')),
    assigned_by uuid not null default auth.uid()
        references auth.users(id) on delete restrict,
    active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint event_member_unique unique (event_id, user_id)
);

create index event_members_user_active_idx
    on public.event_members(user_id, active);
create index event_members_event_idx on public.event_members(event_id);

-- -------------------------------------------------------------
-- 3. PARTICIPANTES INSCRITOS
-- La información personal queda aislada por evento. El mismo DNI
-- puede registrarse en eventos distintos sin exponer otros eventos.
-- Cada inscripción tiene un token QR independiente.
-- -------------------------------------------------------------
create table public.event_registrations (
    id uuid primary key default gen_random_uuid(),
    event_id uuid not null references public.events(id) on delete restrict,
    document_number text not null,
    full_name text not null,
    email text,
    phone text,
    qr_token uuid not null unique default gen_random_uuid(),
    status text not null default 'registered'
        check (status in ('registered', 'cancelled')),
    registered_by uuid not null default auth.uid()
        references auth.users(id) on delete restrict,
    registered_at timestamptz not null default now(),
    checked_in_at timestamptz,
    checked_in_by uuid references auth.users(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint event_registration_document_unique unique (event_id, document_number),
    constraint registration_document_not_empty
        check (char_length(trim(document_number)) > 0),
    constraint registration_name_not_empty
        check (char_length(trim(full_name)) > 0),
    constraint checkin_only_registered
        check (checked_in_at is null or status = 'registered')
);

create index event_registrations_event_idx
    on public.event_registrations(event_id);
create index event_registrations_event_name_idx
    on public.event_registrations(event_id, full_name);
create index event_registrations_attendance_idx
    on public.event_registrations(event_id, checked_in_at);
create index event_registrations_registered_by_idx
    on public.event_registrations(registered_by);

-- -------------------------------------------------------------
-- 4. AUDITORÍA DE ESCANEOS
-- Guarda asistencia aceptada, duplicados y rechazos.
-- -------------------------------------------------------------
create table public.attendance_logs (
    id bigint generated always as identity primary key,
    event_id uuid references public.events(id) on delete set null,
    registration_id uuid references public.event_registrations(id) on delete set null,
    scanner_id uuid references auth.users(id) on delete set null,
    scanned_at timestamptz not null default now(),
    result text not null check (result in (
        'accepted', 'already_attended', 'invalid_qr',
        'cancelled_registration', 'event_not_open',
        'not_authorized'
    ))
);

create index attendance_logs_event_time_idx
    on public.attendance_logs(event_id, scanned_at desc);
create index attendance_logs_scanner_time_idx
    on public.attendance_logs(scanner_id, scanned_at desc);

-- -------------------------------------------------------------
-- 5. ARCHIVO HISTÓRICO
-- Tras una semana del fin del evento, la función de archivo copia
-- una instantánea de los datos. Las tablas originales se conservan
-- para mantener integridad, auditoría y exportaciones consistentes.
-- -------------------------------------------------------------
create table public.archived_events (
    event_id uuid primary key references public.events(id) on delete restrict,
    created_by uuid not null references auth.users(id) on delete restrict,
    name text not null,
    description text,
    location text,
    starts_at timestamptz not null,
    ends_at timestamptz not null,
    final_status text not null,
    registrations_count integer not null default 0,
    attendees_count integer not null default 0,
    archived_at timestamptz not null default now()
);

create table public.archived_registrations (
    registration_id uuid primary key,
    event_id uuid not null references public.archived_events(event_id) on delete cascade,
    document_number text not null,
    full_name text not null,
    email text,
    phone text,
    registration_status text not null,
    registered_by uuid references auth.users(id) on delete set null,
    registered_at timestamptz not null,
    checked_in_at timestamptz,
    checked_in_by uuid references auth.users(id) on delete set null,
    archived_at timestamptz not null default now()
);

create index archived_registrations_event_idx
    on public.archived_registrations(event_id);
create index archived_registrations_attendees_idx
    on public.archived_registrations(event_id, checked_in_at)
    where checked_in_at is not null;

-- -------------------------------------------------------------
-- 6. updated_at AUTOMÁTICO
-- -------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

create trigger events_set_updated_at
before update on public.events
for each row execute function public.set_updated_at();

create trigger event_members_set_updated_at
before update on public.event_members
for each row execute function public.set_updated_at();

create trigger event_registrations_set_updated_at
before update on public.event_registrations
for each row execute function public.set_updated_at();

-- -------------------------------------------------------------
-- 7. FUNCIONES DE AUTORIZACIÓN PARA RLS
-- SECURITY DEFINER evita recursión entre políticas de RLS.
-- -------------------------------------------------------------
create or replace function public.owns_event(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1 from public.events e
        where e.id = p_event_id and e.created_by = (select auth.uid())
    );
$$;

create or replace function public.can_scan_event(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1 from public.events e
        where e.id = p_event_id and e.created_by = (select auth.uid())
    ) or exists (
        select 1 from public.event_members m
        where m.event_id = p_event_id
          and m.user_id = (select auth.uid())
          and m.role = 'scanner'
          and m.active = true
    );
$$;

revoke all on function public.owns_event(uuid) from public, anon;
revoke all on function public.can_scan_event(uuid) from public, anon;
grant execute on function public.owns_event(uuid) to authenticated;
grant execute on function public.can_scan_event(uuid) to authenticated;

-- -------------------------------------------------------------
-- 8. RLS: los usuarios solo gestionan sus eventos y sus datos.
-- -------------------------------------------------------------
alter table public.events enable row level security;
alter table public.event_members enable row level security;
alter table public.event_registrations enable row level security;
alter table public.attendance_logs enable row level security;
alter table public.archived_events enable row level security;
alter table public.archived_registrations enable row level security;

create policy "Users can read own events and assigned events"
on public.events for select to authenticated
using (
    created_by = (select auth.uid())
    or exists (
        select 1 from public.event_members m
        where m.event_id = events.id
          and m.user_id = (select auth.uid())
          and m.active = true
    )
);

create policy "Authenticated users create own events"
on public.events for insert to authenticated
with check (created_by = (select auth.uid()));

create policy "Owners update own events"
on public.events for update to authenticated
using (created_by = (select auth.uid()))
with check (created_by = (select auth.uid()));

create policy "Owners delete own events"
on public.events for delete to authenticated
using (created_by = (select auth.uid()));

create policy "Owners read event members"
on public.event_members for select to authenticated
using (public.owns_event(event_id) or user_id = (select auth.uid()));

create policy "Owners assign scanners"
on public.event_members for insert to authenticated
with check (
    public.owns_event(event_id)
    and assigned_by = (select auth.uid())
    and role = 'scanner'
);

create policy "Owners update scanner assignments"
on public.event_members for update to authenticated
using (public.owns_event(event_id))
with check (public.owns_event(event_id) and role = 'scanner');

create policy "Owners remove scanner assignments"
on public.event_members for delete to authenticated
using (public.owns_event(event_id));

create policy "Owners read event registrations"
on public.event_registrations for select to authenticated
using (public.owns_event(event_id));

create policy "Owners register participants"
on public.event_registrations for insert to authenticated
with check (
    public.owns_event(event_id)
    and registered_by = (select auth.uid())
);

create policy "Owners update event registrations"
on public.event_registrations for update to authenticated
using (public.owns_event(event_id))
with check (public.owns_event(event_id));

create policy "Owners delete event registrations"
on public.event_registrations for delete to authenticated
using (public.owns_event(event_id));

create policy "Owners read attendance logs"
on public.attendance_logs for select to authenticated
using (public.owns_event(event_id));

create policy "Owners read archived events"
on public.archived_events for select to authenticated
using (created_by = (select auth.uid()));

create policy "Owners read archived registrations"
on public.archived_registrations for select to authenticated
using (public.owns_event(event_id));

-- No se permite insertar/editar asistencia directamente desde el cliente.
-- La función scan_event_qr valida permisos y marca la asistencia de forma atómica.
revoke all on public.events from anon, authenticated;
revoke all on public.event_members from anon, authenticated;
revoke all on public.event_registrations from anon, authenticated;
revoke all on public.attendance_logs from anon, authenticated;
revoke all on public.archived_events from anon, authenticated;
revoke all on public.archived_registrations from anon, authenticated;

grant select, insert, update, delete on public.events to authenticated;
grant select, insert, update, delete on public.event_members to authenticated;
grant select, insert, update, delete on public.event_registrations to authenticated;
grant select on public.attendance_logs to authenticated;
grant select on public.archived_events, public.archived_registrations to authenticated;
grant usage, select on sequence public.attendance_logs_id_seq to authenticated;

-- -------------------------------------------------------------
-- 9. VALIDAR QR Y REGISTRAR ASISTENCIA
-- Solo propietario o escaneador activo asignado puede llamar la función.
-- La actualización condicional impide aceptar dos escaneos simultáneos.
-- -------------------------------------------------------------
create or replace function public.scan_event_qr(
    p_event_id uuid,
    p_qr_token uuid
)
returns table (
    scan_result text,
    registration_id uuid,
    participant_name text,
    scanned_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_user_id uuid := auth.uid();
    v_event public.events%rowtype;
    v_registration public.event_registrations%rowtype;
    v_now timestamptz := now();
    v_result text;
begin
    if v_user_id is null then
        raise exception 'Se requiere iniciar sesión.' using errcode = '28000';
    end if;

    select e.* into v_event
    from public.events e
    where e.id = p_event_id;

    if not found then
        insert into public.attendance_logs(event_id, scanner_id, result)
        values (null, v_user_id, 'invalid_qr');
        return query select 'invalid_qr'::text, null::uuid, null::text, v_now;
        return;
    end if;

    if not public.can_scan_event(p_event_id) then
        insert into public.attendance_logs(event_id, scanner_id, result)
        values (p_event_id, v_user_id, 'not_authorized');
        return query select 'not_authorized'::text, null::uuid, null::text, v_now;
        return;
    end if;

    select r.* into v_registration
    from public.event_registrations r
    where r.event_id = p_event_id and r.qr_token = p_qr_token
    for update;

    if not found then
        v_result := 'invalid_qr';
    elsif v_registration.status = 'cancelled' then
        v_result := 'cancelled_registration';
    elsif v_event.status <> 'open' or v_event.archived_at is not null then
        v_result := 'event_not_open';
    elsif v_registration.checked_in_at is not null then
        v_result := 'already_attended';
    else
        update public.event_registrations r
        set checked_in_at = v_now,
            checked_in_by = v_user_id,
            updated_at = v_now
        where r.id = v_registration.id
          and r.checked_in_at is null
          and r.status = 'registered';

        if found then
            v_result := 'accepted';
            v_registration.checked_in_at := v_now;
            v_registration.checked_in_by := v_user_id;
        else
            v_result := 'already_attended';
        end if;
    end if;

    insert into public.attendance_logs(event_id, registration_id, scanner_id, result, scanned_at)
    values (p_event_id, v_registration.id, v_user_id, v_result, v_now);

    return query
    select v_result,
           v_registration.id,
           v_registration.full_name,
           coalesce(v_registration.checked_in_at, v_now);
end;
$$;

revoke all on function public.scan_event_qr(uuid, uuid) from public, anon;
grant execute on function public.scan_event_qr(uuid, uuid) to authenticated;

-- -------------------------------------------------------------
-- 10. ARCHIVAR EVENTOS UNA SEMANA DESPUÉS DE SU FINALIZACIÓN
-- Copia evento + inscripciones a las tablas históricas y marca el
-- evento como archivado. La operación es idempotente y conserva el
-- original para auditoría y exportación.
-- -------------------------------------------------------------
create or replace function public.archive_finished_events()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_event record;
    v_count integer := 0;
begin
    for v_event in
        select e.*
        from public.events e
        where e.archived_at is null
          and e.ends_at <= now() - interval '7 days'
          and e.status in ('open', 'closed', 'cancelled')
    loop
        insert into public.archived_events (
            event_id, created_by, name, description, location,
            starts_at, ends_at, final_status, registrations_count,
            attendees_count, archived_at
        )
        select e.id, e.created_by, e.name, e.description, e.location,
               e.starts_at, e.ends_at, e.status,
               count(r.id)::integer,
               (count(r.id) filter (where r.checked_in_at is not null))::integer,
               now()
        from public.events e
        left join public.event_registrations r on r.event_id = e.id
        where e.id = v_event.id
        group by e.id;

        insert into public.archived_registrations (
            registration_id, event_id, document_number, full_name, email,
            phone, registration_status, registered_by, registered_at,
            checked_in_at, checked_in_by, archived_at
        )
        select r.id, r.event_id, r.document_number, r.full_name, r.email,
               r.phone, r.status, r.registered_by, r.registered_at,
               r.checked_in_at, r.checked_in_by, now()
        from public.event_registrations r
        where r.event_id = v_event.id
        on conflict (registration_id) do nothing;

        update public.events
        set archived_at = now(), status = 'closed'
        where id = v_event.id and archived_at is null;

        v_count := v_count + 1;
    end loop;

    return v_count;
end;
$$;

revoke all on function public.archive_finished_events() from public, anon, authenticated;
-- La función de archivo debe ejecutarse desde un job confiable (Supabase Cron
-- o una Vercel Cron Route protegida), no desde el navegador.
grant execute on function public.archive_finished_events() to service_role;

commit;
