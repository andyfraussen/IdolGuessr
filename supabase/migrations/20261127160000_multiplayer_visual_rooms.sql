-- Visual race rooms (multiplayer phase 1).
--
-- Apply this file to both Supabase projects. The app picks the project from
-- NEXT_PUBLIC_VERCEL_ENV (src/lib/supabase/env.ts):
--   test (preview / local):  cmxamdnyfovgoikbxunk
--   production:              elbiqmbschvswaahfxib
--
-- Idol choice calls start_infinite_round(..., p_bind := false). That is the
-- solo infinite selector, and with p_bind false it does not open a solo round
-- or write a streak. The stage name is read from unlimited_images, which
-- clients cannot select. This function owner must bypass RLS (the postgres
-- role on hosted Supabase does).
--
-- Hangul, classic, and unshuffled rooms are rejected. Solo streak RPCs are
-- not called.

create table public.multiplayer_rooms (
    id uuid primary key default gen_random_uuid(),
    code text not null unique,
    host_id uuid not null references auth.users (id) on delete cascade,
    mode text not null,
    settings jsonb not null,
    status text not null,
    round_index integer not null default 0,
    revision integer not null default 0,
    expires_at timestamptz not null,
    created_at timestamptz not null default now(),
    idol_id integer,
    idol_name text,
    idol_alt_name text,
    idol_group_name text,
    idol_clue jsonb,
    used_buckets text[] not null default '{}',
    used_ids integer[] not null default '{}',
    constraint multiplayer_rooms_mode_check
        check (mode in ('visual', 'hangul', 'classic')),
    constraint multiplayer_rooms_status_check
        check (status in ('lobby', 'playing', 'between_rounds', 'closed'))
);

create table public.multiplayer_members (
    room_id uuid not null references public.multiplayer_rooms (id) on delete cascade,
    user_id uuid not null references auth.users (id) on delete cascade,
    display_name text not null,
    joined_at timestamptz not null default now(),
    last_seen_at timestamptz not null default now(),
    status text not null default 'in_progress',
    guesses text[] not null default '{}',
    wins integer not null default 0,
    primary key (room_id, user_id),
    constraint multiplayer_members_status_check
        check (status in ('in_progress', 'won', 'lost'))
);

-- Public row. One per room. No secret columns. Realtime subscribers refetch
-- get_room from the revision; the stored snapshot never includes another
-- player's guess text while the round is still playing.
create table public.multiplayer_state (
    room_id uuid primary key references public.multiplayer_rooms (id) on delete cascade,
    revision integer not null,
    snapshot jsonb not null
);

create index multiplayer_members_user_idx
    on public.multiplayer_members (user_id);

alter table public.multiplayer_rooms enable row level security;
alter table public.multiplayer_members enable row level security;
alter table public.multiplayer_state enable row level security;

revoke all on table public.multiplayer_rooms from public, anon, authenticated;
revoke all on table public.multiplayer_members from public, anon, authenticated;
revoke all on table public.multiplayer_state from public, anon, authenticated;
grant select on table public.multiplayer_state to authenticated;

-- Realtime evaluates this as the subscriber. They have no grant on
-- multiplayer_members, so the policy cannot read that table itself.
-- The function runs as its owner and returns only this user's membership.
create or replace function public.multiplayer_is_member(p_room uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
    select exists (
        select 1
        from public.multiplayer_members member
        where member.room_id = p_room
          and member.user_id = auth.uid()
    );
$$;

create policy multiplayer_state_member_select
    on public.multiplayer_state
    for select
    to authenticated
    using (public.multiplayer_is_member(room_id));

do $$
begin
    if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'multiplayer_state'
    ) then
        alter publication supabase_realtime add table public.multiplayer_state;
    end if;
end $$;

create or replace function public.multiplayer_name_key(p_name text)
returns text
language sql
immutable
as $$
    select nullif(
        regexp_replace(upper(trim(coalesce(p_name, ''))), '\s+', ' ', 'g'),
        ''
    );
$$;

create or replace function public.multiplayer_max_guesses(p_difficulty text)
returns integer
language sql
immutable
as $$
    select case when p_difficulty = 'challenger' then 3 else 6 end;
$$;

create or replace function public.multiplayer_display_name(p_user uuid)
returns text
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
    select coalesce(
        nullif(trim(nickname), ''),
        'Guest'
    )
    from public.profiles
    where id = p_user;
$$;

create or replace function public.multiplayer_names_match(p_guess text, p_candidate text)
returns boolean
language sql
immutable
as $$
    select public.multiplayer_name_key(p_guess) is not null
       and (
            public.multiplayer_name_key(p_guess) = public.multiplayer_name_key(p_candidate)
            or exists (
                select 1
                from regexp_split_to_table(coalesce(p_candidate, ''), '[,/|;]') piece
                where public.multiplayer_name_key(piece) = public.multiplayer_name_key(p_guess)
            )
       );
$$;

create or replace function public.multiplayer_known_name(p_guess text)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
    select exists (
        select 1
        from public.unlimited_images idol
        where public.multiplayer_names_match(p_guess, idol.name)
           or public.multiplayer_names_match(p_guess, idol.alt_name)
    );
$$;

create or replace function public.multiplayer_snapshot(p_room uuid, p_viewer uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
    v_room public.multiplayer_rooms%rowtype;
    v_players jsonb;
    v_idol jsonb;
    v_answer text;
begin
    select * into v_room
    from public.multiplayer_rooms
    where id = p_room;

    if not found then
        return null;
    end if;

    select coalesce(
        jsonb_agg(
            jsonb_strip_nulls(jsonb_build_object(
                'user_id', member.user_id,
                'display_name', member.display_name,
                'status', case
                    when v_room.round_index > 0 then member.status
                    else null
                end,
                'wins', member.wins,
                'guesses', case
                    when v_room.status <> 'playing'
                      or member.user_id is not distinct from p_viewer
                    then to_jsonb(member.guesses)
                    else null
                end
            ))
            order by (member.user_id = v_room.host_id) desc, member.joined_at
        ),
        '[]'::jsonb
    )
    into v_players
    from public.multiplayer_members member
    where member.room_id = v_room.id;

    v_idol := v_room.idol_clue;
    v_answer := null;
    if v_room.status in ('between_rounds', 'closed')
       and v_room.idol_name is not null
       and length(trim(v_room.idol_name)) > 0
    then
        v_answer := v_room.idol_name;
        if v_idol is not null and coalesce(v_room.idol_group_name, '') <> '' then
            v_idol := v_idol || jsonb_build_object('group_name', v_room.idol_group_name);
        end if;
    end if;

    return jsonb_strip_nulls(jsonb_build_object(
        'code', v_room.code,
        'room_id', v_room.id,
        'revision', v_room.revision,
        'mode', v_room.mode,
        'settings', v_room.settings,
        'status', v_room.status,
        'round_index', v_room.round_index,
        'expires_at', v_room.expires_at,
        'host_id', v_room.host_id,
        'idol', v_idol,
        'answer', v_answer,
        'you', p_viewer,
        'players', v_players
    ));
end;
$$;

create or replace function public.multiplayer_write_state(p_room uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
    v_revision integer;
begin
    update public.multiplayer_rooms
    set revision = revision + 1
    where id = p_room
    returning revision into v_revision;

    insert into public.multiplayer_state (room_id, revision, snapshot)
    values (p_room, v_revision, public.multiplayer_snapshot(p_room, null))
    on conflict (room_id) do update
    set revision = excluded.revision,
        snapshot = excluded.snapshot;
end;
$$;

-- Ends the round when every member seen in the last 30 seconds has won or
-- lost. A missing heartbeat does not block, and it does not mark that player
-- lost. Callers hold the room row lock.
create or replace function public.multiplayer_maybe_finish(p_room uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
    v_status text;
begin
    select status into v_status
    from public.multiplayer_rooms
    where id = p_room;

    if v_status is distinct from 'playing' then
        return false;
    end if;

    if not exists (
        select 1
        from public.multiplayer_members member
        where member.room_id = p_room
          and member.last_seen_at > now() - interval '30 seconds'
    ) then
        return false;
    end if;

    if exists (
        select 1
        from public.multiplayer_members member
        where member.room_id = p_room
          and member.last_seen_at > now() - interval '30 seconds'
          and member.status = 'in_progress'
    ) then
        return false;
    end if;

    update public.multiplayer_rooms
    set status = 'between_rounds'
    where id = p_room;

    perform public.multiplayer_write_state(p_room);
    return true;
end;
$$;

create or replace function public.multiplayer_lock(p_code text)
returns public.multiplayer_rooms
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
    v_room public.multiplayer_rooms%rowtype;
begin
    if auth.uid() is null then
        raise exception 'not_authenticated';
    end if;

    select * into v_room
    from public.multiplayer_rooms
    where code = lower(trim(coalesce(p_code, '')))
    for update;

    if not found then
        raise exception 'room_not_found';
    end if;

    return v_room;
end;
$$;

create or replace function public.multiplayer_require_member(p_room uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
    if not exists (
        select 1
        from public.multiplayer_members member
        where member.room_id = p_room
          and member.user_id = auth.uid()
    ) then
        raise exception 'not_a_member';
    end if;
end;
$$;

create or replace function public.multiplayer_visual_settings(p_settings jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare
    v_difficulty text;
    v_image_mode text;
    v_group text;
    v_gens integer[];
    v_all integer[] := array[2, 3, 4, 5];
begin
    if p_settings is null or jsonb_typeof(p_settings) <> 'object' then
        raise exception 'invalid_settings';
    end if;

    v_difficulty := p_settings->>'difficulty';
    v_image_mode := p_settings->>'image_mode';
    v_group := p_settings->>'group_filter';

    if v_difficulty not in ('easy', 'normal', 'hard', 'challenger')
       or v_image_mode not in ('pixelated', 'zoom')
       or v_group not in ('boy-group', 'girl-group', 'both')
    then
        raise exception 'invalid_settings';
    end if;

    if p_settings ? 'gen_filter'
       and jsonb_typeof(p_settings->'gen_filter') = 'array'
    then
        select coalesce(array_agg(distinct value::integer), '{}')
        into v_gens
        from jsonb_array_elements_text(p_settings->'gen_filter') element(value);

        if v_gens is null or cardinality(v_gens) = 0 then
            raise exception 'invalid_settings';
        end if;

        if exists (
            select 1
            from unnest(v_gens) gen
            where gen <> all (v_all)
        ) then
            raise exception 'invalid_settings';
        end if;

        if v_all <@ v_gens then
            v_gens := null;
        end if;
    else
        v_gens := null;
    end if;

    return jsonb_build_object(
        'difficulty', v_difficulty,
        'image_mode', v_image_mode,
        'group_filter', v_group,
        'gen_filter', to_jsonb(v_gens)
    );
end;
$$;

create or replace function public.create_room(p_mode text, p_settings jsonb)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
    v_code text;
    v_room uuid;
    v_settings jsonb;
    v_attempt integer;
begin
    if auth.uid() is null then
        raise exception 'not_authenticated';
    end if;

    if p_mode is distinct from 'visual' then
        raise exception 'mode_not_available';
    end if;

    v_settings := public.multiplayer_visual_settings(p_settings);

    for v_attempt in 1..5 loop
        v_code := gen_random_uuid()::text;
        begin
            insert into public.multiplayer_rooms (
                code,
                host_id,
                mode,
                settings,
                status,
                expires_at
            )
            values (
                v_code,
                auth.uid(),
                'visual',
                v_settings,
                'lobby',
                now() + interval '24 hours'
            )
            returning id into v_room;
            exit;
        exception
            when unique_violation then
                v_room := null;
        end;
    end loop;

    if v_room is null then
        raise exception 'request_failed';
    end if;

    insert into public.multiplayer_members (room_id, user_id, display_name)
    values (v_room, auth.uid(), coalesce(public.multiplayer_display_name(auth.uid()), 'Guest'));

    perform public.multiplayer_write_state(v_room);
    return v_code;
end;
$$;

create or replace function public.join_room(p_code text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
    v_room public.multiplayer_rooms%rowtype;
    v_count integer;
    v_name text;
begin
    v_room := public.multiplayer_lock(p_code);
    v_name := coalesce(public.multiplayer_display_name(auth.uid()), 'Guest');

    if exists (
        select 1
        from public.multiplayer_members member
        where member.room_id = v_room.id
          and member.user_id = auth.uid()
    ) then
        update public.multiplayer_members
        set display_name = v_name,
            last_seen_at = now()
        where room_id = v_room.id
          and user_id = auth.uid();
        return public.multiplayer_snapshot(v_room.id, auth.uid());
    end if;

    if v_room.expires_at <= now() then
        raise exception 'room_expired';
    end if;

    if v_room.status = 'closed' then
        raise exception 'room_closed';
    end if;

    if v_room.status not in ('lobby', 'playing') then
        raise exception 'room_not_joinable';
    end if;

    select count(*) into v_count
    from public.multiplayer_members member
    where member.room_id = v_room.id;

    if v_count >= 8 then
        raise exception 'room_full';
    end if;

    insert into public.multiplayer_members (room_id, user_id, display_name, status)
    values (
        v_room.id,
        auth.uid(),
        v_name,
        case when v_room.status = 'playing' then 'in_progress' else 'in_progress' end
    );

    perform public.multiplayer_write_state(v_room.id);
    return public.multiplayer_snapshot(v_room.id, auth.uid());
end;
$$;

create or replace function public.leave_room(p_code text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
    v_room public.multiplayer_rooms%rowtype;
    v_next uuid;
    v_closed boolean := false;
    v_finished boolean := false;
begin
    v_room := public.multiplayer_lock(p_code);

    if not exists (
        select 1
        from public.multiplayer_members member
        where member.room_id = v_room.id
          and member.user_id = auth.uid()
    ) then
        return jsonb_build_object('left', true, 'closed', v_room.status = 'closed');
    end if;

    delete from public.multiplayer_members
    where room_id = v_room.id
      and user_id = auth.uid();

    if v_room.host_id = auth.uid() then
        select member.user_id into v_next
        from public.multiplayer_members member
        where member.room_id = v_room.id
        order by member.joined_at asc
        limit 1;

        if v_next is null then
            update public.multiplayer_rooms
            set status = 'closed'
            where id = v_room.id;
            v_closed := true;
        else
            update public.multiplayer_rooms
            set host_id = v_next
            where id = v_room.id;
        end if;
    end if;

    if v_closed then
        perform public.multiplayer_write_state(v_room.id);
    else
        v_finished := public.multiplayer_maybe_finish(v_room.id);
        if not v_finished then
            perform public.multiplayer_write_state(v_room.id);
        end if;
    end if;

    return jsonb_build_object('left', true, 'closed', v_closed);
end;
$$;

create or replace function public.start_round(p_code text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
set row_security = off
as $$
declare
    v_room public.multiplayer_rooms%rowtype;
    v_gens integer[];
    v_group text;
    v_exclude text[];
    v_id integer;
    v_bucket text;
    v_category text;
    v_base64 text;
    v_group_type text;
    v_zoom_x numeric;
    v_zoom_y numeric;
    v_name text;
    v_alt text;
    v_group_name text;
    v_attempt integer;
begin
    v_room := public.multiplayer_lock(p_code);
    perform public.multiplayer_require_member(v_room.id);

    if v_room.host_id is distinct from auth.uid() then
        raise exception 'not_host';
    end if;

    if v_room.expires_at <= now() then
        raise exception 'room_expired';
    end if;

    if v_room.status = 'closed' then
        raise exception 'room_closed';
    end if;

    if v_room.status not in ('lobby', 'between_rounds') then
        raise exception 'not_between_rounds';
    end if;

    if v_room.mode is distinct from 'visual' then
        raise exception 'mode_not_available';
    end if;

    v_group := v_room.settings->>'group_filter';
    if v_group not in ('boy-group', 'girl-group') then
        v_group := null;
    end if;

    v_gens := null;
    if jsonb_typeof(v_room.settings->'gen_filter') = 'array' then
        select array_agg(value::integer)
        into v_gens
        from jsonb_array_elements_text(v_room.settings->'gen_filter') element(value);
    end if;

    v_exclude := coalesce(v_room.used_buckets, '{}');

    for v_attempt in 1..4 loop
        v_id := null;
        v_bucket := null;
        v_category := null;
        v_base64 := null;
        v_group_type := null;
        v_zoom_x := null;
        v_zoom_y := null;

        begin
            select
                picked.id,
                picked.img_bucket,
                picked.group_category,
                picked.base64_group,
                picked.group_type,
                picked.zoom_x,
                picked.zoom_y
            into
                v_id,
                v_bucket,
                v_category,
                v_base64,
                v_group_type,
                v_zoom_x,
                v_zoom_y
            from public.start_infinite_round(
                p_difficulty := v_room.settings->>'difficulty',
                p_image_mode := v_room.settings->>'image_mode',
                p_group := v_group,
                p_gens := v_gens,
                p_count := 1,
                p_exclude := v_exclude,
                p_bind := false
            ) picked
            limit 1;
        exception
            when undefined_function then
                -- Live projects declare p_gens as integer[] or bigint[].
                select
                    picked.id,
                    picked.img_bucket,
                    picked.group_category,
                    picked.base64_group,
                    picked.group_type,
                    picked.zoom_x,
                    picked.zoom_y
                into
                    v_id,
                    v_bucket,
                    v_category,
                    v_base64,
                    v_group_type,
                    v_zoom_x,
                    v_zoom_y
                from public.start_infinite_round(
                    p_difficulty := v_room.settings->>'difficulty',
                    p_image_mode := v_room.settings->>'image_mode',
                    p_group := v_group,
                    p_gens := v_gens::bigint[],
                    p_count := 1,
                    p_exclude := v_exclude,
                    p_bind := false
                ) picked
                limit 1;
        end;

        if v_id is null then
            exit;
        end if;

        if v_id = any (coalesce(v_room.used_ids, '{}'))
           or coalesce(v_bucket, '') = ''
           or coalesce(v_category, '') = ''
           or coalesce(v_base64, '') = ''
        then
            if coalesce(v_bucket, '') <> '' then
                v_exclude := v_exclude || array[v_bucket];
            end if;
            v_id := null;
            continue;
        end if;

        exit;
    end loop;

    if v_id is null then
        raise exception 'not_enough_idols';
    end if;

    select idol.name, idol.alt_name, idol.group_name
    into v_name, v_alt, v_group_name
    from public.unlimited_images idol
    where idol.id = v_id;

    if public.multiplayer_name_key(v_name) is null then
        raise exception 'not_enough_idols';
    end if;

    update public.multiplayer_members
    set status = 'in_progress',
        guesses = '{}'
    where room_id = v_room.id;

    update public.multiplayer_rooms
    set status = 'playing',
        round_index = round_index + 1,
        idol_id = v_id,
        idol_name = v_name,
        idol_alt_name = v_alt,
        idol_group_name = v_group_name,
        idol_clue = jsonb_build_object(
            'img_bucket', v_bucket,
            'group_category', v_category,
            'base64_group', v_base64,
            'group_type', coalesce(v_group_type, ''),
            'zoom_x', v_zoom_x,
            'zoom_y', v_zoom_y
        ),
        used_buckets = coalesce(used_buckets, '{}') || array[v_bucket],
        used_ids = coalesce(used_ids, '{}') || array[v_id]
    where id = v_room.id;

    perform public.multiplayer_write_state(v_room.id);
    return public.multiplayer_snapshot(v_room.id, auth.uid());
end;
$$;

create or replace function public.submit_room_guess(p_code text, p_guess text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
    v_room public.multiplayer_rooms%rowtype;
    v_member public.multiplayer_members%rowtype;
    v_guess text;
    v_max integer;
    v_correct boolean;
    v_status text;
    v_finished boolean;
begin
    v_room := public.multiplayer_lock(p_code);
    perform public.multiplayer_require_member(v_room.id);

    if v_room.expires_at <= now() then
        raise exception 'room_expired';
    end if;

    if v_room.status = 'closed' then
        raise exception 'room_closed';
    end if;

    if v_room.status is distinct from 'playing' then
        raise exception 'not_playing';
    end if;

    if v_room.mode is distinct from 'visual' then
        raise exception 'mode_not_available';
    end if;

    v_guess := public.multiplayer_name_key(p_guess);
    if v_guess is null or length(v_guess) > 40 then
        raise exception 'invalid_guess';
    end if;

    select * into v_member
    from public.multiplayer_members
    where room_id = v_room.id
      and user_id = auth.uid()
    for update;

    update public.multiplayer_members
    set last_seen_at = now()
    where room_id = v_room.id
      and user_id = auth.uid();

    if v_member.status is distinct from 'in_progress'
       or v_guess = any (v_member.guesses)
    then
        return public.multiplayer_snapshot(v_room.id, auth.uid());
    end if;

    if not public.multiplayer_known_name(v_guess) then
        raise exception 'not_in_list';
    end if;

    v_max := public.multiplayer_max_guesses(v_room.settings->>'difficulty');
    v_correct := public.multiplayer_names_match(v_guess, v_room.idol_name)
        or public.multiplayer_names_match(v_guess, v_room.idol_alt_name);

    if v_correct then
        v_status := 'won';
    elsif cardinality(v_member.guesses) + 1 >= v_max then
        v_status := 'lost';
    else
        v_status := 'in_progress';
    end if;

    update public.multiplayer_members
    set guesses = guesses || array[v_guess],
        status = v_status,
        wins = wins + case when v_status = 'won' then 1 else 0 end
    where room_id = v_room.id
      and user_id = auth.uid();

    v_finished := false;
    if v_status <> 'in_progress' then
        v_finished := public.multiplayer_maybe_finish(v_room.id);
        if not v_finished then
            perform public.multiplayer_write_state(v_room.id);
        end if;
    end if;

    return public.multiplayer_snapshot(v_room.id, auth.uid());
end;
$$;

create or replace function public.advance_round(p_code text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
    v_room public.multiplayer_rooms%rowtype;
begin
    v_room := public.multiplayer_lock(p_code);
    perform public.multiplayer_require_member(v_room.id);

    if v_room.host_id is distinct from auth.uid() then
        raise exception 'not_host';
    end if;

    if v_room.status = 'closed' then
        raise exception 'room_closed';
    end if;

    if v_room.status is distinct from 'playing' then
        raise exception 'not_playing';
    end if;

    update public.multiplayer_members
    set status = 'lost'
    where room_id = v_room.id
      and status = 'in_progress';

    update public.multiplayer_rooms
    set status = 'between_rounds'
    where id = v_room.id;

    perform public.multiplayer_write_state(v_room.id);
    return public.multiplayer_snapshot(v_room.id, auth.uid());
end;
$$;

create or replace function public.get_room(p_code text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
    v_room public.multiplayer_rooms%rowtype;
    v_name text;
    v_previous text;
    v_finished boolean := false;
begin
    v_room := public.multiplayer_lock(p_code);
    perform public.multiplayer_require_member(v_room.id);

    v_name := coalesce(public.multiplayer_display_name(auth.uid()), 'Guest');

    select display_name into v_previous
    from public.multiplayer_members
    where room_id = v_room.id
      and user_id = auth.uid();

    update public.multiplayer_members
    set display_name = v_name,
        last_seen_at = now()
    where room_id = v_room.id
      and user_id = auth.uid();

    if v_room.status = 'playing' and v_room.expires_at > now() then
        v_finished := public.multiplayer_maybe_finish(v_room.id);
    end if;

    if v_previous is distinct from v_name and not v_finished then
        perform public.multiplayer_write_state(v_room.id);
    end if;

    return public.multiplayer_snapshot(v_room.id, auth.uid());
end;
$$;

revoke all on function public.multiplayer_name_key(text) from public, anon, authenticated;
revoke all on function public.multiplayer_max_guesses(text) from public, anon, authenticated;
revoke all on function public.multiplayer_display_name(uuid) from public, anon, authenticated;
revoke all on function public.multiplayer_names_match(text, text) from public, anon, authenticated;
revoke all on function public.multiplayer_known_name(text) from public, anon, authenticated;
revoke all on function public.multiplayer_snapshot(uuid, uuid) from public, anon, authenticated;
revoke all on function public.multiplayer_write_state(uuid) from public, anon, authenticated;
revoke all on function public.multiplayer_maybe_finish(uuid) from public, anon, authenticated;
revoke all on function public.multiplayer_lock(text) from public, anon, authenticated;
revoke all on function public.multiplayer_require_member(uuid) from public, anon, authenticated;
revoke all on function public.multiplayer_visual_settings(jsonb) from public, anon, authenticated;

revoke all on function public.multiplayer_is_member(uuid) from public, anon;
grant execute on function public.multiplayer_is_member(uuid) to authenticated;

revoke all on function public.create_room(text, jsonb) from public, anon, authenticated;
revoke all on function public.join_room(text) from public, anon, authenticated;
revoke all on function public.leave_room(text) from public, anon, authenticated;
revoke all on function public.start_round(text) from public, anon, authenticated;
revoke all on function public.submit_room_guess(text, text) from public, anon, authenticated;
revoke all on function public.advance_round(text) from public, anon, authenticated;
revoke all on function public.get_room(text) from public, anon, authenticated;

grant execute on function public.create_room(text, jsonb) to authenticated;
grant execute on function public.join_room(text) to authenticated;
grant execute on function public.leave_room(text) to authenticated;
grant execute on function public.start_round(text) to authenticated;
grant execute on function public.submit_room_guess(text, text) to authenticated;
grant execute on function public.advance_round(text) to authenticated;
grant execute on function public.get_room(text) to authenticated;
