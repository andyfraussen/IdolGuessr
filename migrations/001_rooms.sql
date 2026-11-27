create table rooms (
    id text primary key,
    code text not null unique,
    host_id text not null,
    mode text not null,
    settings jsonb not null,
    status text not null,
    round_index integer not null default 0,
    revision integer not null default 0,
    expires_at timestamptz not null,
    created_at timestamptz not null default now(),
    idol_id integer,
    idol_name text,
    idol_group_name text,
    idol_clue jsonb,
    used_ids jsonb not null default '[]'::jsonb
);

create table room_members (
    room_id text not null references rooms (id) on delete cascade,
    user_id text not null,
    display_name text not null,
    joined_at timestamptz not null default now(),
    last_seen_at timestamptz not null default now(),
    status text not null default 'in_progress',
    guesses jsonb not null default '[]'::jsonb,
    wins integer not null default 0,
    primary key (room_id, user_id)
);

create index room_members_user_idx on room_members (user_id);
