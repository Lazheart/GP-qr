-- ==============================================================================
-- MIGRACIÓN: Control de acceso privado, invitaciones de validadores y seguridad RLS
-- Fecha: 2026-10-15
-- Compatible con bases de datos en producción sin recrear tablas existentes
-- ==============================================================================

begin;

-- 1. Asegurar tabla de invitaciones de validadores si no existe
create table if not exists public.event_member_invitations (
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

create index if not exists event_member_invitations_event_idx
    on public.event_member_invitations(event_id);
create index if not exists event_member_invitations_email_idx
    on public.event_member_invitations(invited_email, status);

-- Trigger updated_at para invitaciones
drop trigger if exists event_member_invitations_set_updated_at on public.event_member_invitations;
create trigger event_member_invitations_set_updated_at
before update on public.event_member_invitations
for each row execute function public.set_updated_at();

-- 2. Triggers de protección contra modificación de campos sensibles
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

drop trigger if exists events_protect_sensitive_fields on public.events;
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

drop trigger if exists event_registrations_protect_sensitive_fields on public.event_registrations;
create trigger event_registrations_protect_sensitive_fields
before update on public.event_registrations
for each row execute function public.protect_registration_sensitive_fields();

-- 3. Habilitar RLS en event_member_invitations
alter table public.event_member_invitations enable row level security;

-- Actualizar políticas RLS de invitaciones
drop policy if exists "Owners read validator invitations" on public.event_member_invitations;
create policy "Owners read validator invitations"
on public.event_member_invitations for select to authenticated
using (public.owns_event(event_id));

drop policy if exists "Owners create validator invitations" on public.event_member_invitations;
create policy "Owners create validator invitations"
on public.event_member_invitations for insert to authenticated
with check (
    public.owns_event(event_id)
    and invited_by = (select auth.uid())
    and status = 'pending'
    and accepted_by is null
    and accepted_at is null
);

drop policy if exists "Owners update validator invitations" on public.event_member_invitations;
create policy "Owners update validator invitations"
on public.event_member_invitations for update to authenticated
using (public.owns_event(event_id))
with check (public.owns_event(event_id));

drop policy if exists "Owners revoke validator invitations" on public.event_member_invitations;
create policy "Owners revoke validator invitations"
on public.event_member_invitations for delete to authenticated
using (public.owns_event(event_id));

-- Actualizar permisos
revoke all on public.event_member_invitations from anon, authenticated;
grant select, insert, update, delete on public.event_member_invitations to authenticated;

-- 4. Actualizar función accept_event_member_invitation
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

-- 5. Crear funciones auxiliares de consulta segura y gestión
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

commit;
