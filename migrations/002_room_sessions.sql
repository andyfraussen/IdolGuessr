create table if not exists room_sessions (
    token_hash text primary key,
    player_id text not null unique,
    created_at timestamptz not null default now()
);
