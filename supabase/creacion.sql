-- =============================================================
-- ESQUEMA COMPLETO Y UNIFICADO - SISTEMA DE ASISTENCIA GPQR
-- Next.js + Vercel + Supabase (PostgreSQL + Supabase Auth)
-- Ejecutar en el Editor SQL de Supabase o mediante supabase db push
-- Incluye: Tablas, Índices, Triggers, RLS, Políticas y Funciones RPC
-- =============================================================

begin;

create extension if not exists pgcrypto;

-- -------------------------------------------------------------
-- 0. LIMPIEZA PREVIA SEGURA (Permite recrear la BD desde cero)
-- -------------------------------------------------------------
drop table if exists public.archived_registrations cascade;
drop table if exists public.archived_events cascade;
drop table if exists public.attendance_logs cascade;
drop table if exists public.event_registrations cascade;
drop table if exists public.event_member_invitations cascade;
drop table if exists public.event_members cascade;
drop table if exists public.events cascade;

drop function if exists public.owns_event(uuid) cascade;
drop function if exists public.can_scan_event(uuid) cascade;
drop function if exists public.accept_event_member_invitation(uuid) cascade;
drop function if exists public.get_invitation_details(uuid) cascade;
drop function if exists public.revoke_validator_invitation(uuid) cascade;
drop function if exists public.create_or_get_validator_invitation(uuid, text) cascade;
drop function if exists public.revoke_event_validator(uuid, uuid) cascade;
drop function if exists public.get_ticket_info(uuid) cascade;
drop function if exists public.scan_event_qr(uuid, uuid) cascade;
drop function if exists public.archive_finished_events() cascade;

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
-- 2. VALIDADORES AUTORIZADOS PARA CADA EVENTO
-- Solo el creador puede asignar o retirar validadores.
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
-- 3. INVITACIONES PARA EQUIPO Y VALIDADORES
-- Token único default gen_random_uuid() para generar enlace de aceptación.
-- -------------------------------------------------------------
create table public.event_member_invitations (
    id uuid primary key default gen_random_uuid(),
    event_id uuid not null references public.events(id) on delete cascade,
    invited_email text not null,
    invitation_token uuid not null unique default gen_random_uuid(),
    status text not null default 'pending'
        check (status in ('pending', 'accepted', 'revoked', 'expired')),
    invited_by uuid not null default auth.uid()
        references auth.users(id) on delete restrict,
    accepted_by uuid references auth.users(id) on delete set null,
    expires_at timestamptz not null default (now() + interval '7 days'),
    accepted_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint event_invitation_email_not_empty
        check (char_length(trim(invited_email)) > 3),
    constraint event_invitation_email_normalized
        check (invited_email = lower(trim(invited_email)))
);

create index event_member_invitations_event_idx
    on public.event_member_invitations(event_id);
create index event_member_invitations_email_idx
    on public.event_member_invitations(invited_email, status);
create index event_member_invitations_token_idx
    on public.event_member_invitations(invitation_token);

-- -------------------------------------------------------------
-- 4. PARTICIPANTES INSCRITOS
-- La información personal queda aislada por evento.
-- Cada inscripción genera su propio qr_token único.
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
create index event_registrations_qr_token_idx
    on public.event_registrations(qr_token);

-- -------------------------------------------------------------
-- 5. AUDITORÍA DE ESCANEOS
-- Registra validaciones aceptadas, duplicados y rechazos.
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
-- 6. ARCHIVO HISTÓRICO
-- Instantánea de eventos e inscripciones finalizados.
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
-- 7. updated_at AUTOMÁTICO Y PROTECCIÓN DE CAMPOS SENSIBLES
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

create trigger event_member_invitations_set_updated_at
before update on public.event_member_invitations
for each row execute function public.set_updated_at();

create trigger event_registrations_set_updated_at
before update on public.event_registrations
for each row execute function public.set_updated_at();

create or replace function public.protect_event_sensitive_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    if new.created_by <> old.created_by then
        raise exception 'No se permite transferir la propiedad del evento.';
    end if;
    return new;
end;
$$;

create trigger events_protect_sensitive_fields
before update on public.events
for each row execute function public.protect_event_sensitive_fields();

create or replace function public.protect_registration_sensitive_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    if new.event_id <> old.event_id then
        raise exception 'No se permite transferir una inscripción a otro evento.';
    end if;
    if new.registered_by <> old.registered_by then
        raise exception 'No se permite modificar el creador original de la inscripción.';
    end if;
    return new;
end;
$$;

create trigger event_registrations_protect_sensitive_fields
before update on public.event_registrations
for each row execute function public.protect_registration_sensitive_fields();

-- -------------------------------------------------------------
-- 8. FUNCIONES DE AUTORIZACIÓN PARA RLS
-- SECURITY DEFINER previene recursión infinita en políticas RLS.
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
-- 9. ROW LEVEL SECURITY (RLS)
-- Los eventos son privados; nadie accede a datos ajenos.
-- -------------------------------------------------------------
alter table public.events enable row level security;
alter table public.event_members enable row level security;
alter table public.event_member_invitations enable row level security;
alter table public.event_registrations enable row level security;
alter table public.attendance_logs enable row level security;
alter table public.archived_events enable row level security;
alter table public.archived_registrations enable row level security;

-- Eventos
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

-- Miembros del equipo
create policy "Owners read event members"
on public.event_members for select to authenticated
using (public.owns_event(event_id) or user_id = (select auth.uid()));

create policy "Owners update scanner assignments"
on public.event_members for update to authenticated
using (public.owns_event(event_id))
with check (public.owns_event(event_id) and role = 'scanner');

create policy "Owners remove scanner assignments"
on public.event_members for delete to authenticated
using (public.owns_event(event_id));

-- Invitaciones de miembros
create policy "Owners read validator invitations"
on public.event_member_invitations for select to authenticated
using (public.owns_event(event_id));

create policy "Owners create validator invitations"
on public.event_member_invitations for insert to authenticated
with check (
    public.owns_event(event_id)
    and invited_by = (select auth.uid())
    and status = 'pending'
    and accepted_by is null
    and accepted_at is null
);

create policy "Owners update validator invitations"
on public.event_member_invitations for update to authenticated
using (public.owns_event(event_id))
with check (public.owns_event(event_id));

create policy "Owners revoke validator invitations"
on public.event_member_invitations for delete to authenticated
using (public.owns_event(event_id));

-- Registros de participantes
create policy "Owners and validators read event registrations"
on public.event_registrations for select to authenticated
using (public.can_scan_event(event_id));

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

-- Logs de auditoría
create policy "Owners and validators read attendance logs"
on public.attendance_logs for select to authenticated
using (event_id is not null and public.can_scan_event(event_id));

-- Históricos
create policy "Owners and validators read archived events"
on public.archived_events for select to authenticated
using (public.can_scan_event(event_id));

create policy "Owners and validators read archived registrations"
on public.archived_registrations for select to authenticated
using (public.can_scan_event(event_id));

-- Revocación y permisos explícitos
revoke all on public.events from anon, authenticated;
revoke all on public.event_members from anon, authenticated;
revoke all on public.event_member_invitations from anon, authenticated;
revoke all on public.event_registrations from anon, authenticated;
revoke all on public.attendance_logs from anon, authenticated;
revoke all on public.archived_events from anon, authenticated;
revoke all on public.archived_registrations from anon, authenticated;

grant select, insert, update, delete on public.events to authenticated;
grant select, insert, update, delete on public.event_members to authenticated;
grant select, insert, update, delete on public.event_member_invitations to authenticated;
grant select, insert, update, delete on public.event_registrations to authenticated;
grant select on public.attendance_logs to authenticated;
grant select on public.archived_events, public.archived_registrations to authenticated;
grant usage, select on sequence public.attendance_logs_id_seq to authenticated;

-- -------------------------------------------------------------
-- 10. FUNCIONES RPC
-- -------------------------------------------------------------

-- 10.1 Aceptar invitación de validador
create or replace function public.accept_event_member_invitation(
    p_invitation_token uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_user_id uuid := auth.uid();
    v_email text := lower(trim(coalesce(nullif(auth.jwt() ->> 'email', ''), (select email from auth.users where id = auth.uid()), '')));
    v_invitation public.event_member_invitations%rowtype;
    v_member_id uuid;
begin
    if v_user_id is null or v_email = '' then
        raise exception 'Debes iniciar sesión con la cuenta invitada.'
            using errcode = '28000';
    end if;

    select i.* into v_invitation
    from public.event_member_invitations i
    where i.invitation_token = p_invitation_token
    for update;

    if not found then
        raise exception 'La invitación no existe o no es válida.';
    end if;
    if v_invitation.status <> 'pending' then
        raise exception 'La invitación ya no está pendiente.';
    end if;
    if v_invitation.expires_at <= now() then
        update public.event_member_invitations
        set status = 'expired', updated_at = now()
        where id = v_invitation.id;
        raise exception 'La invitación ha expirado.';
    end if;
    if v_invitation.invited_email <> v_email then
        raise exception 'Inicia sesión con el correo al que se envió la invitación.'
            using errcode = '42501';
    end if;

    insert into public.event_members (
        event_id, user_id, role, assigned_by, active
    )
    values (
        v_invitation.event_id, v_user_id, 'scanner',
        v_invitation.invited_by, true
    )
    on conflict (event_id, user_id)
    do update set active = true, role = 'scanner', updated_at = now()
    returning id into v_member_id;

    update public.event_member_invitations
    set status = 'accepted', accepted_by = v_user_id, accepted_at = now(), updated_at = now()
    where id = v_invitation.id;

    return v_member_id;
end;
$$;

revoke all on function public.accept_event_member_invitation(uuid) from public, anon;
grant execute on function public.accept_event_member_invitation(uuid) to authenticated;

-- 10.2 Consultar detalles seguros de invitación pública
create or replace function public.get_invitation_details(
    p_invitation_token uuid
)
returns table (
    invitation_id uuid,
    event_id uuid,
    event_name text,
    event_location text,
    starts_at timestamptz,
    ends_at timestamptz,
    invited_email text,
    status text,
    expires_at timestamptz,
    is_valid boolean
)
language sql
security definer
stable
set search_path = ''
as $$
    select
        i.id as invitation_id,
        e.id as event_id,
        e.name as event_name,
        e.location as event_location,
        e.starts_at,
        e.ends_at,
        i.invited_email,
        i.status,
        i.expires_at,
        (i.status = 'pending' and i.expires_at > now() and e.status in ('draft', 'open')) as is_valid
    from public.event_member_invitations i
    join public.events e on e.id = i.event_id
    where i.invitation_token = p_invitation_token;
$$;

revoke all on function public.get_invitation_details(uuid) from public;
grant execute on function public.get_invitation_details(uuid) to anon, authenticated;

-- 10.3 Revocar invitación pendiente
create or replace function public.revoke_validator_invitation(
    p_invitation_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_event_id uuid;
begin
    select event_id into v_event_id
    from public.event_member_invitations
    where id = p_invitation_id;

    if not found or not public.owns_event(v_event_id) then
        raise exception 'No autorizado para revocar esta invitación.'
            using errcode = '42501';
    end if;

    update public.event_member_invitations
    set status = 'revoked', updated_at = now()
    where id = p_invitation_id and status = 'pending';

    return found;
end;
$$;

revoke all on function public.revoke_validator_invitation(uuid) from public, anon;
grant execute on function public.revoke_validator_invitation(uuid) to authenticated;

-- 10.4 Crear o refrescar invitación y token de validador
create or replace function public.create_or_get_validator_invitation(
    p_event_id uuid,
    p_email text
)
returns table (
    invitation_id uuid,
    invitation_token uuid,
    status text,
    expires_at timestamptz,
    already_pending boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_clean_email text := lower(trim(p_email));
    v_inv public.event_member_invitations%rowtype;
    v_new_token uuid;
    v_new_expiry timestamptz := now() + interval '7 days';
begin
    if auth.uid() is null then
        raise exception 'No autenticado.' using errcode = '28000';
    end if;

    if not public.owns_event(p_event_id) then
        raise exception 'No tienes permisos de administración en este evento.' using errcode = '42501';
    end if;

    if v_clean_email is null or char_length(v_clean_email) < 5 or position('@' in v_clean_email) = 0 then
        raise exception 'Formato de correo electrónico inválido.' using errcode = '22023';
    end if;

    select * into v_inv
    from public.event_member_invitations
    where event_id = p_event_id
      and invited_email = v_clean_email
      and status = 'pending'
      and expires_at > now()
    order by created_at desc
    limit 1;

    if found then
        if v_inv.invitation_token is null then
            v_new_token := gen_random_uuid();
            update public.event_member_invitations
            set invitation_token = v_new_token, updated_at = now()
            where id = v_inv.id;
            v_inv.invitation_token := v_new_token;
        end if;

        return query
        select v_inv.id, v_inv.invitation_token, v_inv.status, v_inv.expires_at, true;
        return;
    end if;

    v_new_token := gen_random_uuid();
    insert into public.event_member_invitations (
        event_id,
        invited_email,
        invitation_token,
        status,
        invited_by,
        expires_at
    )
    values (
        p_event_id,
        v_clean_email,
        v_new_token,
        'pending',
        auth.uid(),
        v_new_expiry
    )
    returning * into v_inv;

    return query
    select v_inv.id, v_inv.invitation_token, v_inv.status, v_inv.expires_at, false;
end;
$$;

revoke all on function public.create_or_get_validator_invitation(uuid, text) from public, anon;
grant execute on function public.create_or_get_validator_invitation(uuid, text) to authenticated;

-- 10.5 Retirar validador activo
create or replace function public.revoke_event_validator(
    p_event_id uuid,
    p_member_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
    if not public.owns_event(p_event_id) then
        raise exception 'Solo el creador del evento puede retirar validadores.'
            using errcode = '42501';
    end if;

    update public.event_members
    set active = false, updated_at = now()
    where id = p_member_id and event_id = p_event_id;

    return found;
end;
$$;

revoke all on function public.revoke_event_validator(uuid, uuid) from public, anon;
grant execute on function public.revoke_event_validator(uuid, uuid) to authenticated;

-- 10.6 Consulta de información mínima de entrada para invitados
create or replace function public.get_ticket_info(
    p_qr_token uuid
)
returns table (
    registration_id uuid,
    event_name text,
    event_location text,
    starts_at timestamptz,
    ends_at timestamptz,
    participant_name text,
    status text,
    is_checked_in boolean,
    checked_in_at timestamptz
)
language sql
security definer
stable
set search_path = ''
as $$
    select
        r.id as registration_id,
        e.name as event_name,
        e.location as event_location,
        e.starts_at,
        e.ends_at,
        r.full_name as participant_name,
        r.status,
        (r.checked_in_at is not null) as is_checked_in,
        r.checked_in_at
    from public.event_registrations r
    join public.events e on e.id = r.event_id
    where r.qr_token = p_qr_token;
$$;

revoke all on function public.get_ticket_info(uuid) from public;
grant execute on function public.get_ticket_info(uuid) to anon, authenticated;

-- 10.7 Validar código QR y registrar asistencia atómicamente
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

-- 10.8 Archivar eventos automáticamente una semana después de su fecha de finalización
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
grant execute on function public.archive_finished_events() to service_role;

commit;
