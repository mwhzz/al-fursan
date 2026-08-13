-- =============================================================================
--  Al Fursan Equestrian Academy — Supabase schema  (v2)
--  Dashboard > SQL Editor > New query > paste this whole file > Run.
--  Safe to re-run. Upgrading from v1 keeps existing students/slots/attendance.
-- =============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------- tables ---
create table if not exists app_settings (key text primary key, value text not null);

create table if not exists students (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  pin           text not null check (pin ~ '^[0-9]{4}$'),
  phone         text default '',
  course        text not null default 'basic' check (course in ('basic','advanced','private')),
  total_classes int  not null default 8,
  start_date    date not null default current_date,
  end_date      date,
  tags          text[] not null default '{}',
  note          text default '',
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);
create unique index if not exists students_name_uniq on students (lower(name));

create table if not exists slots (
  id       uuid primary key default gen_random_uuid(),
  day      int  not null check (day between 0 and 6),   -- 0 = Sunday
  time     text not null,                               -- 'HH:MM' 24h
  capacity int  not null default 3,
  coach    text default '',
  horse    text default '',
  active   boolean not null default true
);
create unique index if not exists slots_day_time_uniq on slots (day, time);
alter table slots add column if not exists coach text default '';
alter table slots add column if not exists horse text default '';

create table if not exists slot_students (
  slot_id    uuid references slots(id)    on delete cascade,
  student_id uuid references students(id) on delete cascade,
  primary key (slot_id, student_id)
);

create table if not exists attendance (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  date       date not null default current_date,
  time       text,
  status     text not null default 'present' check (status in ('present','absent','makeup')),
  note       text default '',
  created_at timestamptz not null default now()
);
create unique index if not exists attendance_uniq on attendance (student_id, date, (coalesce("time",'')));

create table if not exists bookings (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references students(id) on delete cascade,
  slot_id      uuid not null references slots(id)    on delete cascade,
  date         date not null,
  status       text not null default 'pending'
               check (status in ('pending','approved','waitlist','declined','cancelled','expired')),
  note         text default '',
  reason       text default '',          -- decline / cancel reason
  seen         boolean not null default false,
  created_at   timestamptz not null default now(),
  decided_at   timestamptz
);
create unique index if not exists bookings_uniq on bookings (student_id, slot_id, date)
  where status in ('pending','approved','waitlist');
create index if not exists bookings_date_idx on bookings (date);
alter table bookings add column if not exists reason text default '';
alter table bookings add column if not exists decided_at timestamptz;

-- one date (optionally one slot) closed: rain, holiday, sick horse
create table if not exists closures (
  id      uuid primary key default gen_random_uuid(),
  date    date not null,
  slot_id uuid references slots(id) on delete cascade,   -- null = whole day
  reason  text default '',
  created_at timestamptz not null default now()
);
create unique index if not exists closures_uniq on closures (date, (coalesce(slot_id,'00000000-0000-0000-0000-000000000000'::uuid)));

create table if not exists payments (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references students(id) on delete cascade,
  amount      numeric(10,2) not null default 0,
  due_date    date,
  paid_on     date,
  cycle_start date,
  cycle_end   date,
  method      text default '',
  note        text default '',
  created_at  timestamptz not null default now()
);
create index if not exists payments_student_idx on payments (student_id);

-- messages shown to a rider inside the app
create table if not exists notifications (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  kind       text not null default 'info',
  title      text not null,
  body       text default '',
  read       boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_student_idx on notifications (student_id, read);

create table if not exists admin_users (
  id         uuid primary key default gen_random_uuid(),
  username   text not null,
  pass       text not null,
  display    text default '',
  role       text not null default 'owner' check (role in ('owner','staff')),
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists admin_users_uniq on admin_users (lower(username));

create table if not exists sessions (
  token      text primary key,
  kind       text not null check (kind in ('admin','student')),
  subject    uuid not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists sessions_expiry_idx on sessions (expires_at);

create table if not exists activity_log (
  id      bigserial primary key,
  actor   text not null default 'system',
  action  text not null,
  detail  text default '',
  at      timestamptz not null default now()
);

create table if not exists error_log (
  id      bigserial primary key,
  kind    text not null default 'client',
  message text not null,
  context text default '',
  at      timestamptz not null default now()
);

create table if not exists login_attempts (
  key          text primary key,
  fails        int not null default 0,
  locked_until timestamptz
);

-- ------------------------------------------------------------ seed data -----
insert into app_settings(key, value) values
  ('academy_name',    'Al Fursan Equestrian Academy'),
  ('timezone',        'Asia/Dhaka'),
  ('contact_phone',   ''),
  ('whatsapp',        ''),
  ('currency',        'BDT'),
  ('capacity',        '3'),
  ('reply_hours',     '24'),
  ('cancel_cutoff_h', '3'),
  ('directory',       'on'),
  ('telegram_token',  ''),
  ('telegram_chat',   ''),
  ('admin_password',  'alfursan')     -- v1 leftover, kept for migration only
on conflict (key) do nothing;

insert into slots (day, time, capacity)
select d, t, 3
from unnest(array[5,6,1,3]) d
cross join unnest(array['16:00','16:50','17:40','18:30','19:20']) t
on conflict (day, time) do nothing;

-- first admin account (migrates the old single password if one was set)
insert into admin_users (username, pass, display, role)
select 'owner', coalesce((select value from app_settings where key='admin_password'), 'alfursan'), 'Owner', 'owner'
where not exists (select 1 from admin_users);

-- ------------------------------------------------------------------ RLS -----
alter table app_settings   enable row level security;
alter table students       enable row level security;
alter table slots          enable row level security;
alter table slot_students  enable row level security;
alter table attendance     enable row level security;
alter table bookings       enable row level security;
alter table closures       enable row level security;
alter table payments       enable row level security;
alter table notifications  enable row level security;
alter table admin_users    enable row level security;
alter table sessions       enable row level security;
alter table activity_log   enable row level security;
alter table error_log      enable row level security;
alter table login_attempts enable row level security;

revoke all on app_settings, students, slots, slot_students, attendance, bookings, closures,
  payments, notifications, admin_users, sessions, activity_log, error_log, login_attempts
  from anon, authenticated;

-- ------------------------------------------------------------- helpers ------
create or replace function public._setting(k text, d text default '')
returns text language sql security definer stable set search_path = public as $$
  select coalesce((select value from app_settings where key = k), d);
$$;

create or replace function public._today()
returns date language sql security definer stable set search_path = public as $$
  select (now() at time zone _setting('timezone','Asia/Dhaka'))::date;
$$;

create or replace function public._new_token()
returns text language sql security definer set search_path = public as $$
  select encode(gen_random_bytes(24), 'hex');
$$;

create or replace function public._admin(p_token text)
returns admin_users language plpgsql security definer set search_path = public as $$
declare a admin_users;
begin
  select au.* into a from sessions s
    join admin_users au on au.id = s.subject
   where s.token = p_token and s.kind = 'admin' and s.expires_at > now() and au.active;
  return a;
end $$;

create or replace function public._student(p_token text)
returns students language plpgsql security definer set search_path = public as $$
declare st students;
begin
  select s2.* into st from sessions s
    join students s2 on s2.id = s.subject
   where s.token = p_token and s.kind = 'student' and s.expires_at > now();
  return st;
end $$;

create or replace function public._log(p_actor text, p_action text, p_detail text default '')
returns void language sql security definer set search_path = public as $$
  insert into activity_log (actor, action, detail) values (p_actor, p_action, p_detail);
$$;

create or replace function public._notify_student(p_student uuid, p_kind text, p_title text, p_body text)
returns void language sql security definer set search_path = public as $$
  insert into notifications (student_id, kind, title, body) values (p_student, p_kind, p_title, p_body);
$$;

-- Telegram relay: fires even when nobody has the app open.
create or replace function public._telegram(p_text text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare tok text; chat text;
begin
  tok  := _setting('telegram_token');
  chat := _setting('telegram_chat');
  if tok = '' or chat = '' then return; end if;
  begin
    perform net.http_post(
      url     := 'https://api.telegram.org/bot' || tok || '/sendMessage',
      body    := jsonb_build_object('chat_id', chat, 'text', p_text),
      headers := '{"Content-Type":"application/json"}'::jsonb);
  exception when others then
    insert into error_log (kind, message) values ('telegram', sqlerrm);
  end;
end $$;

create or replace function public._closed(p_slot uuid, p_date date)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from closures where date = p_date and (slot_id is null or slot_id = p_slot));
$$;

-- confirmed seats only: roster + approved bookings (pending/waitlist do NOT fill a slot)
create or replace function public._slot_taken(p_slot uuid, p_date date)
returns int language sql security definer stable set search_path = public as $$
  select (select count(*) from slot_students where slot_id = p_slot)
       + (select count(*) from bookings where slot_id = p_slot and date = p_date and status = 'approved');
$$;

create or replace function public._slot_pending(p_slot uuid, p_date date)
returns int language sql security definer stable set search_path = public as $$
  select count(*)::int from bookings
   where slot_id = p_slot and date = p_date and status in ('pending','waitlist');
$$;

create or replace function public._schedule(p_admin boolean default false)
returns jsonb language sql security definer stable set search_path = public as $$
  select coalesce(jsonb_agg(x order by (x->>'day')::int, x->>'time'), '[]'::jsonb) from (
    select jsonb_build_object(
      'id', s.id, 'day', s.day, 'time', s.time, 'capacity', s.capacity,
      'coach', s.coach, 'horse', s.horse, 'active', s.active,
      'students', coalesce((
        select jsonb_agg(jsonb_build_object('id', st.id, 'name', st.name, 'course', st.course) order by st.name)
        from slot_students ss join students st on st.id = ss.student_id
        where ss.slot_id = s.id), '[]'::jsonb)
    ) x
    from slots s
    where p_admin or s.active
  ) q;
$$;

create or replace function public._student_json(p_id uuid, p_admin boolean default false)
returns jsonb language sql security definer stable set search_path = public as $$
  select jsonb_build_object(
    'id', s.id, 'name', s.name, 'phone', s.phone, 'course', s.course,
    'total_classes', s.total_classes, 'start_date', s.start_date, 'end_date', s.end_date,
    'tags', to_jsonb(s.tags), 'note', s.note, 'active', s.active,
    'done',    (select count(*) from attendance a where a.student_id = s.id and a.status = 'present'),
    'absent',  (select count(*) from attendance a where a.student_id = s.id and a.status = 'absent'),
    'cycle_done', (select count(*) from attendance a
                    where a.student_id = s.id and a.status = 'present' and a.date >= s.start_date),
    'unpaid',  (select coalesce(sum(amount),0) from payments p where p.student_id = s.id and p.paid_on is null)
  ) || case when p_admin then jsonb_build_object('pin', s.pin) else '{}'::jsonb end
  from students s where s.id = p_id;
$$;

create or replace function public._public_settings()
returns jsonb language sql security definer stable set search_path = public as $$
  select jsonb_build_object(
    'academy_name', _setting('academy_name','Al Fursan Equestrian Academy'),
    'timezone', _setting('timezone','Asia/Dhaka'),
    'contact_phone', _setting('contact_phone'),
    'whatsapp', _setting('whatsapp'),
    'currency', _setting('currency','BDT'),
    'capacity', _setting('capacity','3'),
    'reply_hours', _setting('reply_hours','24'),
    'cancel_cutoff_h', _setting('cancel_cutoff_h','3'),
    'directory', _setting('directory','on'),
    'today', _today());
$$;

-- ========================================================== PUBLIC / RIDER ==
create or replace function public.bootstrap()
returns jsonb language sql security definer set search_path = public as $$
  select jsonb_build_object('ok', true, 'settings', _public_settings(),
    'directory', case when _setting('directory','on') = 'on' then
      coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name) order by name)
                from students where active), '[]'::jsonb)
      else '[]'::jsonb end);
$$;

create or replace function public.student_login(p_id uuid, p_name text, p_pin text, p_days int default 30)
returns jsonb language plpgsql security definer set search_path = public as $$
declare st students; k text; la login_attempts; tok text;
begin
  k := 'stu:' || lower(coalesce(p_id::text, trim(p_name), '?'));
  select * into la from login_attempts where key = k;
  if la.locked_until is not null and la.locked_until > now() then
    return jsonb_build_object('ok', false, 'error', 'locked',
      'seconds', ceil(extract(epoch from (la.locked_until - now()))));
  end if;

  if p_id is not null then
    select * into st from students where id = p_id and pin = p_pin and active;
  else
    select * into st from students where lower(name) = lower(trim(p_name)) and pin = p_pin and active;
  end if;

  if st.id is null then
    insert into login_attempts (key, fails) values (k, 1)
      on conflict (key) do update set fails = login_attempts.fails + 1,
        locked_until = case when login_attempts.fails + 1 >= 5 then now() + interval '60 seconds' else null end;
    return jsonb_build_object('ok', false, 'error', 'login');
  end if;

  delete from login_attempts where key = k;
  tok := _new_token();
  insert into sessions (token, kind, subject, expires_at)
    values (tok, 'student', st.id, now() + make_interval(days => greatest(1, p_days)));
  return jsonb_build_object('ok', true, 'token', tok);
end $$;

create or replace function public.student_session(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare st students;
begin
  st := _student(p_token);
  if st.id is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;

  return jsonb_build_object(
    'ok', true,
    'settings', _public_settings(),
    'student', _student_json(st.id),
    'attendance', coalesce((select jsonb_agg(jsonb_build_object(
        'id', a.id, 'date', a.date, 'time', a.time, 'status', a.status, 'note', a.note)
        order by a.date desc) from attendance a where a.student_id = st.id), '[]'::jsonb),
    'bookings', coalesce((select jsonb_agg(jsonb_build_object(
        'id', b.id, 'slot_id', b.slot_id, 'date', b.date, 'status', b.status, 'reason', b.reason,
        'created_at', b.created_at, 'time', s.time, 'day', s.day) order by b.date desc)
        from bookings b join slots s on s.id = b.slot_id
        where b.student_id = st.id and b.date >= _today() - 60), '[]'::jsonb),
    'payments', coalesce((select jsonb_agg(jsonb_build_object(
        'id', p.id, 'amount', p.amount, 'due_date', p.due_date, 'paid_on', p.paid_on,
        'cycle_start', p.cycle_start, 'cycle_end', p.cycle_end, 'note', p.note)
        order by coalesce(p.due_date, p.created_at::date) desc)
        from payments p where p.student_id = st.id), '[]'::jsonb),
    'notifications', coalesce((select jsonb_agg(jsonb_build_object(
        'id', nt.id, 'kind', nt.kind, 'title', nt.title, 'body', nt.body,
        'read', nt.read, 'created_at', nt.created_at) order by nt.created_at desc)
        from notifications nt where nt.student_id = st.id limit 40), '[]'::jsonb),
    'closures', coalesce((select jsonb_agg(jsonb_build_object(
        'date', c.date, 'slot_id', c.slot_id, 'reason', c.reason))
        from closures c where c.date >= _today()), '[]'::jsonb),
    'seats', coalesce((select jsonb_object_agg(k, v) from (
        select (s.id::text || '|' || d::text) k,
               jsonb_build_object('taken', _slot_taken(s.id, d), 'pending', _slot_pending(s.id, d)) v
        from slots s
        cross join generate_series(_today(), _today() + 34, interval '1 day') g(d)
        where s.active and extract(dow from d)::int = s.day
      ) q), '{}'::jsonb),
    'schedule', _schedule()
  );
end $$;

create or replace function public.student_book(p_token text, p_slot uuid, p_date date, p_note text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare st students; v_cap int; v_day int; v_taken int; v_status text; v_left int;
begin
  st := _student(p_token);
  if st.id is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  if p_date < _today() then return jsonb_build_object('ok', false, 'error', 'past'); end if;
  if _closed(p_slot, p_date) then return jsonb_build_object('ok', false, 'error', 'closed'); end if;

  select capacity, day into v_cap, v_day from slots where id = p_slot and active;
  if v_cap is null then return jsonb_build_object('ok', false, 'error', 'missing'); end if;
  if extract(dow from p_date)::int <> v_day then return jsonb_build_object('ok', false, 'error', 'day'); end if;

  if st.end_date is not null and st.end_date < p_date then
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;
  v_left := st.total_classes - (select count(*) from attendance a where a.student_id = st.id and a.status = 'present')
            - (select count(*) from bookings b where b.student_id = st.id and b.status in ('pending','approved') and b.date >= _today());
  if v_left <= 0 then return jsonb_build_object('ok', false, 'error', 'nobalance'); end if;

  if exists (select 1 from slot_students where slot_id = p_slot and student_id = st.id)
     or exists (select 1 from bookings where slot_id = p_slot and student_id = st.id
                and date = p_date and status in ('pending','approved','waitlist')) then
    return jsonb_build_object('ok', false, 'error', 'exists');
  end if;

  v_taken := _slot_taken(p_slot, p_date);
  v_status := case when v_taken >= v_cap then 'waitlist' else 'pending' end;

  insert into bookings (student_id, slot_id, date, note, status)
    values (st.id, p_slot, p_date, coalesce(p_note,''), v_status);

  perform _telegram('🐴 ' || st.name || ' — ' || to_char(p_date, 'DD Mon') || ' ' ||
    (select "time" from slots where id = p_slot) || case when v_status = 'waitlist' then ' (waitlist)' else '' end);
  perform _log(st.name, 'booking.request', to_char(p_date,'YYYY-MM-DD'));
  return jsonb_build_object('ok', true, 'status', v_status);
end $$;

create or replace function public.student_cancel(p_token text, p_id uuid, p_reason text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare st students; b bookings; cutoff int; when_ts timestamptz;
begin
  st := _student(p_token);
  if st.id is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  select * into b from bookings where id = p_id and student_id = st.id;
  if not found then return jsonb_build_object('ok', false, 'error', 'missing'); end if;

  cutoff := coalesce(nullif(_setting('cancel_cutoff_h','3'),'')::int, 3);
  when_ts := (b.date::text || ' ' || (select "time" from slots where id = b.slot_id) || ':00')::timestamp
             at time zone _setting('timezone','Asia/Dhaka');
  if b.status = 'approved' and when_ts - now() < make_interval(hours => cutoff) then
    return jsonb_build_object('ok', false, 'error', 'cutoff', 'hours', cutoff);
  end if;

  update bookings set status = 'cancelled', reason = coalesce(p_reason,''), decided_at = now() where id = p_id;
  perform _telegram('❌ ' || st.name || ' cancelled ' || to_char(b.date,'DD Mon') ||
                    case when coalesce(p_reason,'') <> '' then ' — ' || p_reason else '' end);
  perform _log(st.name, 'booking.cancel', coalesce(p_reason,''));
  perform public._promote_waitlist(b.slot_id, b.date);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.student_absence(p_token text, p_slot uuid, p_date date, p_reason text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare st students;
begin
  st := _student(p_token);
  if st.id is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  insert into attendance (student_id, date, "time", status, note)
    values (st.id, p_date, (select "time" from slots where id = p_slot), 'absent', 'notified: ' || coalesce(p_reason,''))
    on conflict (student_id, date, (coalesce("time",''))) do update
      set status = 'absent', note = 'notified: ' || coalesce(p_reason,'');
  perform _telegram('🚫 ' || st.name || ' cannot attend ' || to_char(p_date,'DD Mon') ||
                    case when coalesce(p_reason,'') <> '' then ' — ' || p_reason else '' end);
  perform _log(st.name, 'absence.notice', to_char(p_date,'YYYY-MM-DD'));
  perform public._promote_waitlist(p_slot, p_date);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.student_update(p_token text, p_phone text, p_pin text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare st students;
begin
  st := _student(p_token);
  if st.id is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  if p_pin is not null and p_pin <> '' and p_pin !~ '^[0-9]{4}$' then
    return jsonb_build_object('ok', false, 'error', 'pin');
  end if;
  update students set phone = coalesce(p_phone, phone),
    pin = case when coalesce(p_pin,'') = '' then pin else p_pin end
  where id = st.id;
  perform _log(st.name, 'profile.update', '');
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.student_seen(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare st students;
begin
  st := _student(p_token);
  if st.id is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  update notifications set read = true where student_id = st.id and not read;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.logout(p_token text)
returns jsonb language sql security definer set search_path = public as $$
  delete from sessions where token = p_token;
  select jsonb_build_object('ok', true);
$$;

create or replace function public.log_error(p_kind text, p_message text, p_context text default '')
returns jsonb language sql security definer set search_path = public as $$
  insert into error_log (kind, message, context) values (coalesce(p_kind,'client'), left(p_message, 500), left(coalesce(p_context,''), 1000));
  select jsonb_build_object('ok', true);
$$;

-- when a seat frees up, offer it to the first person waiting
create or replace function public._promote_waitlist(p_slot uuid, p_date date)
returns void language plpgsql security definer set search_path = public as $$
declare v_cap int; b bookings; nm text;
begin
  select capacity into v_cap from slots where id = p_slot;
  if v_cap is null then return; end if;
  while _slot_taken(p_slot, p_date) < v_cap loop
    select * into b from bookings
      where slot_id = p_slot and date = p_date and status = 'waitlist'
      order by created_at limit 1;
    exit when not found;
    update bookings set status = 'pending', seen = false where id = b.id;
    select name into nm from students where id = b.student_id;
    perform _notify_student(b.student_id, 'waitlist', 'A seat opened up',
      'Your waitlisted class on ' || to_char(p_date,'DD Mon') || ' is now waiting for approval.');
    perform _telegram('⬆️ Waitlist moved up: ' || nm || ' — ' || to_char(p_date,'DD Mon'));
  end loop;
end $$;

-- ========================================================= ADMIN ENDPOINTS ==
create or replace function public.admin_login(p_user text, p_pass text, p_days int default 7)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a admin_users; k text; la login_attempts; tok text;
begin
  k := 'adm:' || lower(coalesce(p_user,'?'));
  select * into la from login_attempts where key = k;
  if la.locked_until is not null and la.locked_until > now() then
    return jsonb_build_object('ok', false, 'error', 'locked',
      'seconds', ceil(extract(epoch from (la.locked_until - now()))));
  end if;

  select * into a from admin_users where lower(username) = lower(trim(p_user)) and pass = p_pass and active;
  if a.id is null then
    insert into login_attempts (key, fails) values (k, 1)
      on conflict (key) do update set fails = login_attempts.fails + 1,
        locked_until = case when login_attempts.fails + 1 >= 5 then now() + interval '60 seconds' else null end;
    return jsonb_build_object('ok', false, 'error', 'login');
  end if;

  delete from login_attempts where key = k;
  tok := _new_token();
  insert into sessions (token, kind, subject, expires_at)
    values (tok, 'admin', a.id, now() + make_interval(days => greatest(1, p_days)));
  perform _log(a.username, 'admin.login', '');
  return jsonb_build_object('ok', true, 'token', tok,
    'admin', jsonb_build_object('id', a.id, 'username', a.username, 'display', a.display, 'role', a.role));
end $$;

create or replace function public.admin_session(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a admin_users; d date;
begin
  a := _admin(p_token);
  if a.id is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  d := _today();
  return jsonb_build_object(
    'ok', true,
    'admin', jsonb_build_object('id', a.id, 'username', a.username, 'display', a.display, 'role', a.role),
    'settings', _public_settings() || jsonb_build_object(
      'telegram_token', _setting('telegram_token'), 'telegram_chat', _setting('telegram_chat')),
    'students', coalesce((select jsonb_agg(_student_json(s.id, true) order by s.name) from students s), '[]'::jsonb),
    'schedule', _schedule(true),
    'attendance', coalesce((select jsonb_agg(jsonb_build_object(
        'id', a2.id, 'student_id', a2.student_id, 'date', a2.date, 'time', a2.time,
        'status', a2.status, 'note', a2.note) order by a2.date desc)
        from (select * from attendance order by date desc limit 800) a2), '[]'::jsonb),
    'bookings', coalesce((select jsonb_agg(jsonb_build_object(
        'id', b.id, 'student_id', b.student_id, 'student', st.name, 'slot_id', b.slot_id,
        'date', b.date, 'time', s.time, 'day', s.day, 'status', b.status, 'seen', b.seen,
        'note', b.note, 'reason', b.reason, 'created_at', b.created_at) order by b.created_at desc)
        from bookings b join students st on st.id = b.student_id join slots s on s.id = b.slot_id
        where b.date >= d - 30), '[]'::jsonb),
    'payments', coalesce((select jsonb_agg(jsonb_build_object(
        'id', p.id, 'student_id', p.student_id, 'amount', p.amount, 'due_date', p.due_date,
        'paid_on', p.paid_on, 'cycle_start', p.cycle_start, 'cycle_end', p.cycle_end, 'note', p.note)
        order by coalesce(p.due_date, p.created_at::date) desc) from payments p), '[]'::jsonb),
    'closures', coalesce((select jsonb_agg(jsonb_build_object(
        'id', c.id, 'date', c.date, 'slot_id', c.slot_id, 'reason', c.reason))
        from closures c where c.date >= d - 30), '[]'::jsonb),
    'admins', coalesce((select jsonb_agg(jsonb_build_object(
        'id', u.id, 'username', u.username, 'display', u.display, 'role', u.role, 'active', u.active)
        order by u.username) from admin_users u), '[]'::jsonb),
    'activity', coalesce((select jsonb_agg(jsonb_build_object(
        'actor', l.actor, 'action', l.action, 'detail', l.detail, 'at', l.at) order by l.id desc)
        from (select * from activity_log order by id desc limit 60) l), '[]'::jsonb),
    'unseen', (select count(*) from bookings where not seen and status in ('pending','waitlist')),
    'alerts', jsonb_build_object(
      'expiring', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'end_date', s.end_date))
        from students s where s.active and s.end_date is not null
          and s.end_date between d and d + 7), '[]'::jsonb),
      'exhausted', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name))
        from students s where s.active and s.total_classes <=
          (select count(*) from attendance a where a.student_id = s.id and a.status = 'present')), '[]'::jsonb),
      'unpaid', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'amount', t.amt))
        from (select student_id, sum(amount) amt from payments where paid_on is null group by student_id) t
        join students s on s.id = t.student_id), '[]'::jsonb)),
    'stats', jsonb_build_object(
      'students', (select count(*) from students where active),
      'week', (select count(*) from attendance where date >= d - 7 and status = 'present'),
      'month_income', (select coalesce(sum(amount),0) from payments where paid_on >= date_trunc('month', d)::date))
  );
end $$;

create or replace function public.admin_student_detail(p_token text, p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a admin_users;
begin
  a := _admin(p_token);
  if a.id is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  return jsonb_build_object('ok', true,
    'student', _student_json(p_id, true),
    'attendance', coalesce((select jsonb_agg(jsonb_build_object(
        'id', x.id, 'date', x.date, 'time', x.time, 'status', x.status, 'note', x.note)
        order by x.date desc) from attendance x where x.student_id = p_id), '[]'::jsonb),
    'bookings', coalesce((select jsonb_agg(jsonb_build_object(
        'id', b.id, 'date', b.date, 'time', s.time, 'status', b.status, 'reason', b.reason)
        order by b.date desc) from bookings b join slots s on s.id = b.slot_id
        where b.student_id = p_id), '[]'::jsonb),
    'payments', coalesce((select jsonb_agg(jsonb_build_object(
        'id', p.id, 'amount', p.amount, 'due_date', p.due_date, 'paid_on', p.paid_on, 'note', p.note)
        order by coalesce(p.due_date, p.created_at::date) desc)
        from payments p where p.student_id = p_id), '[]'::jsonb),
    'slots', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'day', s.day, 'time', s.time))
        from slot_students ss join slots s on s.id = ss.slot_id where ss.student_id = p_id), '[]'::jsonb));
end $$;

create or replace function public.admin_save_student(p_token text, p_data jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a admin_users; v_id uuid;
begin
  a := _admin(p_token);
  if a.id is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  v_id := nullif(p_data->>'id','')::uuid;
  if exists (select 1 from students where lower(name) = lower(trim(p_data->>'name'))
             and (v_id is null or id <> v_id)) then
    return jsonb_build_object('ok', false, 'error', 'duplicate');
  end if;

  if v_id is null then
    insert into students (name, pin, phone, course, total_classes, start_date, end_date, tags, note, active)
    values (trim(p_data->>'name'), p_data->>'pin', coalesce(p_data->>'phone',''),
            coalesce(p_data->>'course','basic'), coalesce((p_data->>'total_classes')::int, 8),
            coalesce((p_data->>'start_date')::date, _today()), nullif(p_data->>'end_date','')::date,
            coalesce(array(select jsonb_array_elements_text(p_data->'tags')), '{}'),
            coalesce(p_data->>'note',''), coalesce((p_data->>'active')::boolean, true))
    returning id into v_id;
    perform _log(a.username, 'student.create', p_data->>'name');
  else
    update students set
      name = trim(p_data->>'name'), pin = p_data->>'pin', phone = coalesce(p_data->>'phone',''),
      course = coalesce(p_data->>'course','basic'), total_classes = coalesce((p_data->>'total_classes')::int, 8),
      start_date = coalesce((p_data->>'start_date')::date, _today()),
      end_date = nullif(p_data->>'end_date','')::date,
      tags = coalesce(array(select jsonb_array_elements_text(p_data->'tags')), '{}'),
      note = coalesce(p_data->>'note',''), active = coalesce((p_data->>'active')::boolean, true)
    where id = v_id;
    perform _log(a.username, 'student.update', p_data->>'name');
  end if;
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

create or replace function public.admin_delete_student(p_token text, p_id uuid, p_confirm text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a admin_users; nm text;
begin
  a := _admin(p_token);
  if a.id is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  select name into nm from students where id = p_id;
  if nm is null then return jsonb_build_object('ok', false, 'error', 'missing'); end if;
  if lower(trim(coalesce(p_confirm,''))) <> lower(nm) then
    return jsonb_build_object('ok', false, 'error', 'confirm');
  end if;
  delete from students where id = p_id;
  perform _log(a.username, 'student.delete', nm);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_mark(p_token text, p_student uuid, p_date date, p_time text, p_status text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a admin_users; v_id uuid;
begin
  a := _admin(p_token);
  if a.id is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;

  if coalesce(p_status,'none') = 'none' then
    delete from attendance where student_id = p_student and date = p_date
      and coalesce("time",'') = coalesce(p_time,'');
    return jsonb_build_object('ok', true, 'status', 'none');
  end if;

  update attendance set status = p_status
    where student_id = p_student and date = p_date and coalesce("time",'') = coalesce(p_time,'')
    returning id into v_id;
  if v_id is null then
    insert into attendance (student_id, date, "time", status)
      values (p_student, p_date, p_time, p_status) returning id into v_id;
  end if;
  return jsonb_build_object('ok', true, 'id', v_id, 'status', p_status);
end $$;

create or replace function public.admin_mark_bulk(p_token text, p_slot uuid, p_date date, p_status text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a admin_users; v_time text; r record; n int := 0;
begin
  a := _admin(p_token);
  if a.id is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  select "time" into v_time from slots where id = p_slot;
  for r in
    select student_id from slot_students where slot_id = p_slot
    union
    select student_id from bookings where slot_id = p_slot and date = p_date and status = 'approved'
  loop
    perform admin_mark(p_token, r.student_id, p_date, v_time, p_status);
    n := n + 1;
  end loop;
  perform _log(a.username, 'attendance.bulk', p_status || ' ×' || n);
  return jsonb_build_object('ok', true, 'count', n);
end $$;

create or replace function public.admin_booking_action(p_token text, p_ids uuid[], p_action text,
  p_reason text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare a admin_users; b bookings; v_id uuid; nm text; n int := 0;
begin
  a := _admin(p_token);
  if a.id is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;

  foreach v_id in array p_ids loop
    select * into b from bookings where id = v_id;
    continue when not found;
    select name into nm from students where id = b.student_id;

    if p_action = 'approve' then
      update bookings set status = 'approved', seen = true, decided_at = now() where id = b.id;
      perform _notify_student(b.student_id, 'approved', 'Class confirmed',
        to_char(b.date, 'DD Mon') || ' · ' || (select "time" from slots where id = b.slot_id));
    elsif p_action = 'decline' then
      update bookings set status = 'declined', seen = true, reason = coalesce(p_reason,''), decided_at = now()
        where id = b.id;
      perform _notify_student(b.student_id, 'declined', 'Booking not confirmed',
        to_char(b.date, 'DD Mon') || case when coalesce(p_reason,'') <> '' then ' — ' || p_reason else '' end);
      perform public._promote_waitlist(b.slot_id, b.date);
    elsif p_action = 'undo' then
      update bookings set status = 'pending', decided_at = null, reason = '' where id = b.id;
    elsif p_action = 'delete' then
      delete from bookings where id = b.id;
    else
      return jsonb_build_object('ok', false, 'error', 'action');
    end if;
    n := n + 1;
    perform _log(a.username, 'booking.' || p_action, coalesce(nm,''));
  end loop;
  return jsonb_build_object('ok', true, 'count', n);
end $$;

create or replace function public.admin_bookings_seen(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a admin_users;
begin
  a := _admin(p_token);
  if a.id is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  update bookings set seen = true where not seen;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_close_day(p_token text, p_date date, p_slot uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a admin_users; r record;
begin
  a := _admin(p_token);
  if a.id is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  insert into closures (date, slot_id, reason) values (p_date, p_slot, coalesce(p_reason,''))
    on conflict do nothing;

  for r in select b.id, b.student_id from bookings b
           where b.date = p_date and (p_slot is null or b.slot_id = p_slot)
             and b.status in ('pending','approved','waitlist') loop
    update bookings set status = 'cancelled', reason = 'Class cancelled: ' || coalesce(p_reason,'') where id = r.id;
    perform _notify_student(r.student_id, 'closed', 'Class cancelled',
      to_char(p_date, 'DD Mon') || case when coalesce(p_reason,'') <> '' then ' — ' || p_reason else '' end);
  end loop;
  perform _log(a.username, 'day.close', to_char(p_date,'YYYY-MM-DD') || ' ' || coalesce(p_reason,''));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_open_day(p_token text, p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a admin_users;
begin
  a := _admin(p_token);
  if a.id is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  delete from closures where id = p_id;
  perform _log(a.username, 'day.open', '');
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_save_slot(p_token text, p_data jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a admin_users; v_id uuid;
begin
  a := _admin(p_token);
  if a.id is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  v_id := nullif(p_data->>'id','')::uuid;
  if exists (select 1 from slots where day = (p_data->>'day')::int and time = p_data->>'time'
             and (v_id is null or id <> v_id)) then
    return jsonb_build_object('ok', false, 'error', 'duplicate');
  end if;
  if v_id is null then
    insert into slots (day, time, capacity, coach, horse, active)
      values ((p_data->>'day')::int, p_data->>'time', coalesce((p_data->>'capacity')::int, 3),
              coalesce(p_data->>'coach',''), coalesce(p_data->>'horse',''),
              coalesce((p_data->>'active')::boolean, true))
      returning id into v_id;
  else
    update slots set day = (p_data->>'day')::int, time = p_data->>'time',
      capacity = coalesce((p_data->>'capacity')::int, 3),
      coach = coalesce(p_data->>'coach',''), horse = coalesce(p_data->>'horse',''),
      active = coalesce((p_data->>'active')::boolean, true) where id = v_id;
  end if;
  perform _log(a.username, 'slot.save', p_data->>'time');
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

create or replace function public.admin_delete_slot(p_token text, p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a admin_users;
begin
  a := _admin(p_token);
  if a.id is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  delete from slots where id = p_id;
  perform _log(a.username, 'slot.delete', '');
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_add_to_slot(p_token text, p_slot uuid, p_student uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a admin_users; v_cap int; v_n int;
begin
  a := _admin(p_token);
  if a.id is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  select capacity into v_cap from slots where id = p_slot;
  if v_cap is null then return jsonb_build_object('ok', false, 'error', 'missing'); end if;
  if exists (select 1 from slot_students where slot_id = p_slot and student_id = p_student) then
    return jsonb_build_object('ok', false, 'error', 'exists');
  end if;
  select count(*) into v_n from slot_students where slot_id = p_slot;
  if v_n >= v_cap then return jsonb_build_object('ok', false, 'error', 'full', 'capacity', v_cap); end if;
  insert into slot_students (slot_id, student_id) values (p_slot, p_student);
  perform _log(a.username, 'roster.add', '');
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_remove_from_slot(p_token text, p_slot uuid, p_student uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a admin_users;
begin
  a := _admin(p_token);
  if a.id is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  delete from slot_students where slot_id = p_slot and student_id = p_student;
  perform _log(a.username, 'roster.remove', '');
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_save_payment(p_token text, p_data jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a admin_users; v_id uuid; v_student uuid;
begin
  a := _admin(p_token);
  if a.id is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  v_id := nullif(p_data->>'id','')::uuid;
  v_student := (p_data->>'student_id')::uuid;
  if v_id is null then
    insert into payments (student_id, amount, due_date, paid_on, cycle_start, cycle_end, method, note)
      values (v_student, coalesce((p_data->>'amount')::numeric, 0), nullif(p_data->>'due_date','')::date,
              nullif(p_data->>'paid_on','')::date, nullif(p_data->>'cycle_start','')::date,
              nullif(p_data->>'cycle_end','')::date, coalesce(p_data->>'method',''), coalesce(p_data->>'note',''))
      returning id into v_id;
  else
    update payments set amount = coalesce((p_data->>'amount')::numeric, 0),
      due_date = nullif(p_data->>'due_date','')::date, paid_on = nullif(p_data->>'paid_on','')::date,
      cycle_start = nullif(p_data->>'cycle_start','')::date, cycle_end = nullif(p_data->>'cycle_end','')::date,
      method = coalesce(p_data->>'method',''), note = coalesce(p_data->>'note','') where id = v_id;
  end if;
  if nullif(p_data->>'paid_on','') is not null then
    perform _notify_student(v_student, 'payment', 'Payment received',
      _setting('currency','BDT') || ' ' || (p_data->>'amount'));
  end if;
  perform _log(a.username, 'payment.save', p_data->>'amount');
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

create or replace function public.admin_delete_payment(p_token text, p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a admin_users;
begin
  a := _admin(p_token);
  if a.id is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  delete from payments where id = p_id;
  perform _log(a.username, 'payment.delete', '');
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_save_settings(p_token text, p_data jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a admin_users; k text;
begin
  a := _admin(p_token);
  if a.id is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  for k in select jsonb_object_keys(p_data) loop
    if k in ('academy_name','timezone','contact_phone','whatsapp','currency','capacity',
             'reply_hours','cancel_cutoff_h','directory','telegram_token','telegram_chat') then
      insert into app_settings (key, value) values (k, p_data->>k)
        on conflict (key) do update set value = excluded.value;
    end if;
  end loop;
  perform _log(a.username, 'settings.save', '');
  return jsonb_build_object('ok', true, 'settings', _public_settings());
end $$;

create or replace function public.admin_change_password(p_token text, p_current text, p_new text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a admin_users;
begin
  a := _admin(p_token);
  if a.id is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  if a.pass <> p_current then return jsonb_build_object('ok', false, 'error', 'current'); end if;
  if length(coalesce(p_new,'')) < 6 then return jsonb_build_object('ok', false, 'error', 'short'); end if;
  update admin_users set pass = p_new where id = a.id;
  delete from sessions where kind = 'admin' and subject = a.id and token <> p_token;
  perform _log(a.username, 'admin.password', '');
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_save_user(p_token text, p_data jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a admin_users; v_id uuid;
begin
  a := _admin(p_token);
  if a.id is null or a.role <> 'owner' then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  v_id := nullif(p_data->>'id','')::uuid;
  if v_id is null then
    if exists (select 1 from admin_users where lower(username) = lower(p_data->>'username')) then
      return jsonb_build_object('ok', false, 'error', 'duplicate');
    end if;
    insert into admin_users (username, pass, display, role)
      values (lower(trim(p_data->>'username')), p_data->>'pass',
              coalesce(p_data->>'display',''), coalesce(p_data->>'role','staff'))
      returning id into v_id;
  else
    update admin_users set display = coalesce(p_data->>'display', display),
      role = coalesce(p_data->>'role', role), active = coalesce((p_data->>'active')::boolean, active),
      pass = case when coalesce(p_data->>'pass','') = '' then pass else p_data->>'pass' end
    where id = v_id;
  end if;
  perform _log(a.username, 'admin.user.save', p_data->>'username');
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

create or replace function public.admin_delete_user(p_token text, p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a admin_users;
begin
  a := _admin(p_token);
  if a.id is null or a.role <> 'owner' then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  if a.id = p_id then return jsonb_build_object('ok', false, 'error', 'self'); end if;
  delete from admin_users where id = p_id;
  perform _log(a.username, 'admin.user.delete', '');
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_notify_test(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a admin_users;
begin
  a := _admin(p_token);
  if a.id is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  if _setting('telegram_token') = '' or _setting('telegram_chat') = '' then
    return jsonb_build_object('ok', false, 'error', 'unset');
  end if;
  perform _telegram('✅ Al Fursan test message');
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_export(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a admin_users;
begin
  a := _admin(p_token);
  if a.id is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  return jsonb_build_object('ok', true, 'data', jsonb_build_object(
    'version', 2, 'exported_at', now(),
    'students',   (select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) from students s),
    'slots',      (select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) from slots s),
    'roster',     (select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) from slot_students s),
    'attendance', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from attendance x),
    'bookings',   (select coalesce(jsonb_agg(to_jsonb(b)), '[]'::jsonb) from bookings b),
    'payments',   (select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb) from payments p),
    'closures',   (select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb) from closures c),
    'settings',   (select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) from app_settings)));
end $$;

-- p_mode: 'preview' counts what would change, 'merge' upserts, 'replace' wipes first
create or replace function public.admin_import(p_token text, p_data jsonb, p_mode text default 'preview')
returns jsonb language plpgsql security definer set search_path = public as $$
declare a admin_users; r jsonb; n_stu int := 0; n_slot int := 0; n_att int := 0; n_pay int := 0;
begin
  a := _admin(p_token);
  if a.id is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  if p_data is null then return jsonb_build_object('ok', false, 'error', 'empty'); end if;

  n_stu  := coalesce(jsonb_array_length(p_data->'students'), 0);
  n_slot := coalesce(jsonb_array_length(p_data->'slots'), 0);
  n_att  := coalesce(jsonb_array_length(p_data->'attendance'), 0);
  n_pay  := coalesce(jsonb_array_length(p_data->'payments'), 0);

  if p_mode = 'preview' then
    return jsonb_build_object('ok', true, 'preview', true,
      'students', n_stu, 'slots', n_slot, 'attendance', n_att, 'payments', n_pay,
      'current', jsonb_build_object(
        'students', (select count(*) from students), 'slots', (select count(*) from slots),
        'attendance', (select count(*) from attendance), 'payments', (select count(*) from payments)));
  end if;

  if p_mode = 'replace' then
    delete from attendance; delete from bookings; delete from payments;
    delete from slot_students; delete from closures; delete from slots; delete from students;
  end if;

  for r in select * from jsonb_array_elements(coalesce(p_data->'students','[]'::jsonb)) loop
    insert into students (id, name, pin, phone, course, total_classes, start_date, end_date, tags, note, active)
      values ((r->>'id')::uuid, r->>'name', r->>'pin', coalesce(r->>'phone',''),
              coalesce(r->>'course','basic'), coalesce((r->>'total_classes')::int, 8),
              coalesce((r->>'start_date')::date, _today()), nullif(r->>'end_date','')::date,
              coalesce(array(select jsonb_array_elements_text(r->'tags')), '{}'),
              coalesce(r->>'note',''), coalesce((r->>'active')::boolean, true))
      on conflict (id) do update set name = excluded.name, pin = excluded.pin, phone = excluded.phone,
        course = excluded.course, total_classes = excluded.total_classes, start_date = excluded.start_date,
        end_date = excluded.end_date, tags = excluded.tags, note = excluded.note, active = excluded.active;
  end loop;

  for r in select * from jsonb_array_elements(coalesce(p_data->'slots','[]'::jsonb)) loop
    insert into slots (id, day, time, capacity, coach, horse, active)
      values ((r->>'id')::uuid, (r->>'day')::int, r->>'time', coalesce((r->>'capacity')::int,3),
              coalesce(r->>'coach',''), coalesce(r->>'horse',''), coalesce((r->>'active')::boolean, true))
      on conflict (id) do update set day = excluded.day, time = excluded.time,
        capacity = excluded.capacity, coach = excluded.coach, horse = excluded.horse, active = excluded.active;
  end loop;

  for r in select * from jsonb_array_elements(coalesce(p_data->'roster','[]'::jsonb)) loop
    insert into slot_students (slot_id, student_id) values ((r->>'slot_id')::uuid, (r->>'student_id')::uuid)
      on conflict do nothing;
  end loop;

  for r in select * from jsonb_array_elements(coalesce(p_data->'attendance','[]'::jsonb)) loop
    insert into attendance (id, student_id, date, "time", status, note)
      values ((r->>'id')::uuid, (r->>'student_id')::uuid, (r->>'date')::date, r->>'time',
              coalesce(r->>'status','present'), coalesce(r->>'note',''))
      on conflict (id) do nothing;
  end loop;

  for r in select * from jsonb_array_elements(coalesce(p_data->'payments','[]'::jsonb)) loop
    insert into payments (id, student_id, amount, due_date, paid_on, cycle_start, cycle_end, method, note)
      values ((r->>'id')::uuid, (r->>'student_id')::uuid, coalesce((r->>'amount')::numeric,0),
              nullif(r->>'due_date','')::date, nullif(r->>'paid_on','')::date,
              nullif(r->>'cycle_start','')::date, nullif(r->>'cycle_end','')::date,
              coalesce(r->>'method',''), coalesce(r->>'note',''))
      on conflict (id) do nothing;
  end loop;

  perform _log(a.username, 'data.import', p_mode);
  return jsonb_build_object('ok', true, 'students', n_stu, 'slots', n_slot,
    'attendance', n_att, 'payments', n_pay);
end $$;

-- --------------------------------------------------------------- grants -----
do $$
declare f text;
begin
  for f in select 'public.' || p.proname || '(' ||
      pg_get_function_identity_arguments(p.oid) || ')'
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like '\_%'
  loop
    execute 'revoke execute on function ' || f || ' from anon, authenticated';
  end loop;
end $$;

grant execute on function
  public.bootstrap(),
  public.student_login(uuid,text,text,int),
  public.student_session(text),
  public.student_book(text,uuid,date,text),
  public.student_cancel(text,uuid,text),
  public.student_absence(text,uuid,date,text),
  public.student_update(text,text,text),
  public.student_seen(text),
  public.logout(text),
  public.log_error(text,text,text),
  public.admin_login(text,text,int),
  public.admin_session(text),
  public.admin_student_detail(text,uuid),
  public.admin_save_student(text,jsonb),
  public.admin_delete_student(text,uuid,text),
  public.admin_mark(text,uuid,date,text,text),
  public.admin_mark_bulk(text,uuid,date,text),
  public.admin_booking_action(text,uuid[],text,text),
  public.admin_bookings_seen(text),
  public.admin_close_day(text,date,uuid,text),
  public.admin_open_day(text,uuid),
  public.admin_save_slot(text,jsonb),
  public.admin_delete_slot(text,uuid),
  public.admin_add_to_slot(text,uuid,uuid),
  public.admin_remove_from_slot(text,uuid,uuid),
  public.admin_save_payment(text,jsonb),
  public.admin_delete_payment(text,uuid),
  public.admin_save_settings(text,jsonb),
  public.admin_change_password(text,text,text),
  public.admin_save_user(text,jsonb),
  public.admin_delete_user(text,uuid),
  public.admin_notify_test(text),
  public.admin_export(text),
  public.admin_import(text,jsonb,text)
to anon;

-- ================================ Telegram ==================================
-- Notifications reach you with the app CLOSED. Setup, once:
--   1) Telegram e @BotFather -> /newbot -> token copy koro
--   2) Bot ke ekta message pathao, tarpor kholo:
--      https://api.telegram.org/bot<TOKEN>/getUpdates  -> "chat":{"id": ...}
--   3) App > Admin > Settings > Notifications e token + chat id paste kore Save
--   4) "Send test message" chapo
-- pg_net Supabase e default install thake; na thakle:
--   create extension if not exists pg_net with schema extensions;
-- ============================================================================
