-- =============================================================================
--  Al Fursan Equestrian Academy — Supabase schema
--  Supabase Dashboard > SQL Editor > New query > paste this whole file > Run.
--  Safe to re-run (idempotent).
-- =============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------- tables ---
create table if not exists app_settings (
  key   text primary key,
  value text not null
);

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
  active   boolean not null default true
);
create unique index if not exists slots_day_time_uniq on slots (day, time);

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

-- booking requests made by students for a specific date + slot
create table if not exists bookings (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  slot_id    uuid not null references slots(id)    on delete cascade,
  date       date not null,
  status     text not null default 'pending' check (status in ('pending','approved','declined','cancelled')),
  note       text default '',
  seen       boolean not null default false,   -- has the admin seen this request?
  created_at timestamptz not null default now()
);
create unique index if not exists bookings_uniq on bookings (student_id, slot_id, date)
  where status in ('pending','approved');
create index if not exists bookings_date_idx on bookings (date);

insert into app_settings(key, value) values ('admin_password', 'alfursan')
  on conflict (key) do nothing;

-- --------------------------------------------------------- seed the slots ---
-- Fri(5) Sat(6) Mon(1) Wed(3)  ×  4:00 / 4:50 / 5:40 / 6:30 / 7:20 PM
insert into slots (day, time, capacity)
select d, t, 3
from unnest(array[5,6,1,3]) d
cross join unnest(array['16:00','16:50','17:40','18:30','19:20']) t
on conflict (day, time) do nothing;

-- ------------------------------------------------------------------ RLS -----
-- Every table is locked down. The anon key can ONLY reach the functions below.
alter table app_settings  enable row level security;
alter table students      enable row level security;
alter table slots         enable row level security;
alter table slot_students enable row level security;
alter table attendance    enable row level security;
alter table bookings      enable row level security;

revoke all on app_settings, students, slots, slot_students, attendance, bookings from anon, authenticated;

-- ------------------------------------------------------------- helpers ------
create or replace function public._admin_ok(p_pass text)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from app_settings where key = 'admin_password' and value = p_pass);
$$;

create or replace function public._student_ok(p_name text, p_pin text)
returns uuid language sql security definer stable set search_path = public as $$
  select id from students
  where lower(name) = lower(trim(p_name)) and pin = p_pin
  limit 1;
$$;

-- slot roster + confirmed bookings occupying a slot on a given date
create or replace function public._slot_used(p_slot uuid, p_date date)
returns int language sql security definer stable set search_path = public as $$
  select (select count(*) from slot_students where slot_id = p_slot)
       + (select count(*) from bookings
          where slot_id = p_slot and date = p_date and status in ('pending','approved'));
$$;

create or replace function public._schedule()
returns jsonb language sql security definer stable set search_path = public as $$
  select coalesce(jsonb_agg(x order by x->>'day', x->>'time'), '[]'::jsonb) from (
    select jsonb_build_object(
      'id', s.id, 'day', s.day, 'time', s.time, 'capacity', s.capacity,
      'students', coalesce((
        select jsonb_agg(jsonb_build_object('id', st.id, 'name', st.name, 'course', st.course) order by st.name)
        from slot_students ss join students st on st.id = ss.student_id
        where ss.slot_id = s.id), '[]'::jsonb)
    ) x
    from slots s where s.active
  ) q;
$$;

create or replace function public._student_json(p_id uuid)
returns jsonb language sql security definer stable set search_path = public as $$
  select jsonb_build_object(
    'id', s.id, 'name', s.name, 'phone', s.phone, 'course', s.course,
    'total_classes', s.total_classes, 'start_date', s.start_date, 'end_date', s.end_date,
    'tags', to_jsonb(s.tags), 'note', s.note, 'active', s.active,
    'done', (select count(*) from attendance a where a.student_id = s.id and a.status <> 'absent')
  ) from students s where s.id = p_id;
$$;

-- ======================================================= STUDENT ENDPOINTS ==
create or replace function public.student_login(p_name text, p_pin text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  v_id := _student_ok(p_name, p_pin);
  if v_id is null then return jsonb_build_object('ok', false, 'error', 'login'); end if;

  return jsonb_build_object(
    'ok', true,
    'student', _student_json(v_id),
    'attendance', coalesce((select jsonb_agg(jsonb_build_object(
        'id', a.id, 'date', a.date, 'time', a.time, 'status', a.status, 'note', a.note)
        order by a.date desc) from attendance a where a.student_id = v_id), '[]'::jsonb),
    'bookings', coalesce((select jsonb_agg(jsonb_build_object(
        'id', b.id, 'slot_id', b.slot_id, 'date', b.date, 'status', b.status,
        'time', s.time, 'day', s.day) order by b.date)
        from bookings b join slots s on s.id = b.slot_id
        where b.student_id = v_id and b.date >= current_date - 30
          and b.status in ('pending','approved')), '[]'::jsonb),
    'schedule', _schedule()
  );
end $$;

create or replace function public.student_book(p_name text, p_pin text, p_slot uuid, p_date date, p_note text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_cap int; v_used int; v_day int;
begin
  v_id := _student_ok(p_name, p_pin);
  if v_id is null then return jsonb_build_object('ok', false, 'error', 'login'); end if;
  if p_date < current_date then return jsonb_build_object('ok', false, 'error', 'past'); end if;

  select capacity, day into v_cap, v_day from slots where id = p_slot and active;
  if v_cap is null then return jsonb_build_object('ok', false, 'error', 'missing'); end if;
  if extract(dow from p_date)::int <> v_day then return jsonb_build_object('ok', false, 'error', 'day'); end if;

  if exists (select 1 from slot_students where slot_id = p_slot and student_id = v_id)
     or exists (select 1 from bookings where slot_id = p_slot and student_id = v_id
                and date = p_date and status in ('pending','approved')) then
    return jsonb_build_object('ok', false, 'error', 'exists');
  end if;

  v_used := _slot_used(p_slot, p_date);
  if v_used >= v_cap then
    return jsonb_build_object('ok', false, 'error', 'full', 'capacity', v_cap);
  end if;

  insert into bookings (student_id, slot_id, date, note) values (v_id, p_slot, p_date, coalesce(p_note,''));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.student_cancel_booking(p_name text, p_pin text, p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  v_id := _student_ok(p_name, p_pin);
  if v_id is null then return jsonb_build_object('ok', false, 'error', 'login'); end if;
  update bookings set status = 'cancelled' where id = p_id and student_id = v_id;
  return jsonb_build_object('ok', true);
end $$;

-- ========================================================= ADMIN ENDPOINTS ==
create or replace function public.admin_login(p_pass text)
returns jsonb language sql security definer set search_path = public as $$
  select jsonb_build_object('ok', _admin_ok(p_pass));
$$;

create or replace function public.admin_overview(p_pass text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not _admin_ok(p_pass) then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  return jsonb_build_object(
    'ok', true,
    -- admin (and only admin) also gets each student's PIN so it can be shown / reset
    'students', coalesce((select jsonb_agg(_student_json(s.id) || jsonb_build_object('pin', s.pin)
                                           order by s.name) from students s), '[]'::jsonb),
    'schedule', _schedule(),
    'attendance', coalesce((select jsonb_agg(jsonb_build_object(
        'id', a.id, 'student_id', a.student_id, 'date', a.date, 'time', a.time, 'status', a.status)
        order by a.date desc) from (
          select * from attendance order by date desc limit 500) a), '[]'::jsonb),
    'bookings', coalesce((select jsonb_agg(jsonb_build_object(
        'id', b.id, 'student_id', b.student_id, 'student', st.name, 'slot_id', b.slot_id,
        'date', b.date, 'time', s.time, 'day', s.day, 'status', b.status, 'seen', b.seen,
        'note', b.note, 'created_at', b.created_at) order by b.created_at desc)
        from bookings b join students st on st.id = b.student_id join slots s on s.id = b.slot_id
        where b.date >= current_date - 14), '[]'::jsonb),
    'unseen', (select count(*) from bookings where not seen and status = 'pending'),
    'stats', jsonb_build_object(
      'students', (select count(*) from students where active),
      'week', (select count(*) from attendance where date >= current_date - 7 and status <> 'absent'),
      'slots', (select count(*) from slots where active))
  );
end $$;

create or replace function public.admin_bookings_seen(p_pass text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not _admin_ok(p_pass) then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  update bookings set seen = true where not seen;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_booking_action(p_pass text, p_id uuid, p_action text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare b bookings;
begin
  if not _admin_ok(p_pass) then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  select * into b from bookings where id = p_id;
  if not found then return jsonb_build_object('ok', false, 'error', 'missing'); end if;

  if p_action = 'approve' then
    update bookings set status = 'approved', seen = true where id = p_id;
  elsif p_action = 'decline' then
    update bookings set status = 'declined', seen = true where id = p_id;
  elsif p_action = 'delete' then
    delete from bookings where id = p_id;
  else
    return jsonb_build_object('ok', false, 'error', 'action');
  end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_save_student(p_pass text, p_data jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not _admin_ok(p_pass) then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  v_id := nullif(p_data->>'id','')::uuid;

  if exists (select 1 from students where lower(name) = lower(trim(p_data->>'name'))
             and (v_id is null or id <> v_id)) then
    return jsonb_build_object('ok', false, 'error', 'duplicate');
  end if;

  if v_id is null then
    insert into students (name, pin, phone, course, total_classes, start_date, end_date, tags, note, active)
    values (trim(p_data->>'name'), p_data->>'pin', coalesce(p_data->>'phone',''),
            coalesce(p_data->>'course','basic'), coalesce((p_data->>'total_classes')::int, 8),
            coalesce((p_data->>'start_date')::date, current_date), nullif(p_data->>'end_date','')::date,
            coalesce(array(select jsonb_array_elements_text(p_data->'tags')), '{}'),
            coalesce(p_data->>'note',''), coalesce((p_data->>'active')::boolean, true))
    returning id into v_id;
  else
    update students set
      name = trim(p_data->>'name'), pin = p_data->>'pin', phone = coalesce(p_data->>'phone',''),
      course = coalesce(p_data->>'course','basic'), total_classes = coalesce((p_data->>'total_classes')::int, 8),
      start_date = coalesce((p_data->>'start_date')::date, current_date),
      end_date = nullif(p_data->>'end_date','')::date,
      tags = coalesce(array(select jsonb_array_elements_text(p_data->'tags')), '{}'),
      note = coalesce(p_data->>'note',''), active = coalesce((p_data->>'active')::boolean, true)
    where id = v_id;
  end if;
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

create or replace function public.admin_delete_student(p_pass text, p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not _admin_ok(p_pass) then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  delete from students where id = p_id;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_add_to_slot(p_pass text, p_slot uuid, p_student uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_cap int; v_n int;
begin
  if not _admin_ok(p_pass) then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  select capacity into v_cap from slots where id = p_slot;
  if v_cap is null then return jsonb_build_object('ok', false, 'error', 'missing'); end if;
  if exists (select 1 from slot_students where slot_id = p_slot and student_id = p_student) then
    return jsonb_build_object('ok', false, 'error', 'exists');
  end if;
  select count(*) into v_n from slot_students where slot_id = p_slot;
  if v_n >= v_cap then return jsonb_build_object('ok', false, 'error', 'full', 'capacity', v_cap); end if;
  insert into slot_students (slot_id, student_id) values (p_slot, p_student);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_remove_from_slot(p_pass text, p_slot uuid, p_student uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not _admin_ok(p_pass) then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  delete from slot_students where slot_id = p_slot and student_id = p_student;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_mark(p_pass text, p_student uuid, p_date date, p_time text, p_status text default 'present')
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not _admin_ok(p_pass) then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  update attendance set status = p_status
    where student_id = p_student and date = p_date and coalesce("time",'') = coalesce(p_time,'')
    returning id into v_id;
  if v_id is null then
    insert into attendance (student_id, date, "time", status)
      values (p_student, p_date, p_time, p_status) returning id into v_id;
  end if;
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

create or replace function public.admin_unmark(p_pass text, p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not _admin_ok(p_pass) then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  delete from attendance where id = p_id;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_save_slot(p_pass text, p_data jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not _admin_ok(p_pass) then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  v_id := nullif(p_data->>'id','')::uuid;
  if exists (select 1 from slots where day = (p_data->>'day')::int and time = p_data->>'time'
             and (v_id is null or id <> v_id)) then
    return jsonb_build_object('ok', false, 'error', 'duplicate');
  end if;
  if v_id is null then
    insert into slots (day, time, capacity) values ((p_data->>'day')::int, p_data->>'time',
      coalesce((p_data->>'capacity')::int, 3)) returning id into v_id;
  else
    update slots set day = (p_data->>'day')::int, time = p_data->>'time',
      capacity = coalesce((p_data->>'capacity')::int, 3),
      active = coalesce((p_data->>'active')::boolean, true) where id = v_id;
  end if;
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

create or replace function public.admin_delete_slot(p_pass text, p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not _admin_ok(p_pass) then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  delete from slots where id = p_id;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_set_password(p_pass text, p_new text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not _admin_ok(p_pass) then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  if length(coalesce(p_new,'')) < 4 then return jsonb_build_object('ok', false, 'error', 'short'); end if;
  update app_settings set value = p_new where key = 'admin_password';
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_export(p_pass text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not _admin_ok(p_pass) then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  return jsonb_build_object('ok', true, 'data', jsonb_build_object(
    'students',   (select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) from students s),
    'slots',      (select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) from slots s),
    'roster',     (select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) from slot_students s),
    'attendance', (select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) from attendance a),
    'bookings',   (select coalesce(jsonb_agg(to_jsonb(b)), '[]'::jsonb) from bookings b),
    'exported_at', now()));
end $$;

-- --------------------------------------------------------------- grants -----
revoke execute on function public._admin_ok(text)                 from anon, authenticated;
revoke execute on function public._student_ok(text,text)           from anon, authenticated;
revoke execute on function public._slot_used(uuid,date)            from anon, authenticated;
revoke execute on function public._schedule()                      from anon, authenticated;
revoke execute on function public._student_json(uuid)              from anon, authenticated;

grant execute on function
  public.student_login(text,text),
  public.student_book(text,text,uuid,date,text),
  public.student_cancel_booking(text,text,uuid),
  public.admin_login(text),
  public.admin_overview(text),
  public.admin_bookings_seen(text),
  public.admin_booking_action(text,uuid,text),
  public.admin_save_student(text,jsonb),
  public.admin_delete_student(text,uuid),
  public.admin_add_to_slot(text,uuid,uuid),
  public.admin_remove_from_slot(text,uuid,uuid),
  public.admin_mark(text,uuid,date,text,text),
  public.admin_unmark(text,uuid),
  public.admin_save_slot(text,jsonb),
  public.admin_delete_slot(text,uuid),
  public.admin_set_password(text,text),
  public.admin_export(text)
to anon;

-- =============================================================================
--  OPTIONAL: push the booking alert to Telegram / WhatsApp / email as well.
--
--  1) Telegram e @BotFather diye ekta bot banao -> token pabe
--  2) Bot ke message dao, tarpor
--     https://api.telegram.org/bot<TOKEN>/getUpdates theke chat id nao
--  3) Niche token + chat id boshiye ei block ta run koro.
--     (pg_net Supabase e already installed thake)
-- =============================================================================
-- create extension if not exists pg_net with schema extensions;
--
-- create or replace function public.notify_admin_booking()
-- returns trigger language plpgsql security definer set search_path = public as $$
-- declare msg text; s text;
-- begin
--   select name into s from students where id = new.student_id;
--   msg := '🐴 New booking: ' || s || ' — ' || to_char(new.date, 'DD Mon') ||
--          ' at ' || (select "time" from slots where id = new.slot_id);
--   perform extensions.http_post(
--     'https://api.telegram.org/bot<TOKEN>/sendMessage',
--     jsonb_build_object('chat_id', '<CHAT_ID>', 'text', msg),
--     '{}'::jsonb, '{"Content-Type":"application/json"}'::jsonb);
--   return new;
-- end $$;
--
-- drop trigger if exists booking_notify on bookings;
-- create trigger booking_notify after insert on bookings
--   for each row execute function public.notify_admin_booking();
