create type public.app_role as enum ('dispatcher', 'driver');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null default '',
  full_name text not null default '',
  phone text not null default '',
  activated_at timestamptz,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "own or dispatcher reads profiles" on public.profiles for select to authenticated
  using (id = auth.uid() or public.has_role(auth.uid(), 'dispatcher'));
create policy "update own profile" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy "own or dispatcher reads roles" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'dispatcher'));

create table public.driver_status (
  user_id uuid primary key,
  lat double precision,
  lng double precision,
  accuracy_m double precision,
  location_at timestamptz,
  stops_done integer not null default 0,
  stops_total integer not null default 0,
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.driver_status to authenticated;
grant all on public.driver_status to service_role;
alter table public.driver_status enable row level security;
create policy "driver or dispatcher reads status" on public.driver_status for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'dispatcher'));
create policy "driver inserts own status" on public.driver_status for insert to authenticated
  with check (user_id = auth.uid());
create policy "driver updates own status" on public.driver_status for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
alter publication supabase_realtime add table public.driver_status;
alter publication supabase_realtime add table public.profiles;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  if not exists (select 1 from public.user_roles where role = 'dispatcher') then
    insert into public.user_roles (user_id, role) values (new.id, 'dispatcher');
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.handle_user_signed_in()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.last_sign_in_at is not null and old.last_sign_in_at is null then
    update public.profiles set activated_at = new.last_sign_in_at where id = new.id and activated_at is null;
  end if;
  return new;
end $$;
create trigger on_auth_user_signed_in after update of last_sign_in_at on auth.users
  for each row execute function public.handle_user_signed_in();

CREATE TABLE public.company_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id text NOT NULL,
  plate text NOT NULL,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  model_name text,
  kind text,
  fuel text,
  fuel_per_100km double precision,
  upkeep_per_km double precision,
  capacity_parcels integer,
  payload_kg integer,
  CONSTRAINT company_vehicles_plate_unique UNIQUE (plate)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_vehicles TO authenticated;
GRANT ALL ON public.company_vehicles TO service_role;
ALTER TABLE public.company_vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team reads vehicles" ON public.company_vehicles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'dispatcher') OR public.has_role(auth.uid(), 'driver'));
CREATE POLICY "dispatcher adds vehicles" ON public.company_vehicles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'dispatcher'));
CREATE POLICY "dispatcher edits vehicles" ON public.company_vehicles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'dispatcher')) WITH CHECK (public.has_role(auth.uid(), 'dispatcher'));
CREATE POLICY "dispatcher removes vehicles" ON public.company_vehicles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'dispatcher'));

CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ref text NOT NULL DEFAULT '',
  client_name text NOT NULL,
  client_type text NOT NULL DEFAULT 'retail',
  phone text NOT NULL DEFAULT '',
  address text NOT NULL,
  district text NOT NULL DEFAULT '—',
  lat double precision,
  lng double precision,
  priority text NOT NULL DEFAULT 'normal',
  parcels integer NOT NULL DEFAULT 1,
  time_window text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  delivery_date date NOT NULL DEFAULT (current_date + 1),
  status text NOT NULL DEFAULT 'new',
  driver_id uuid,
  stop_order integer,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dispatcher manages orders" ON public.orders FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'dispatcher')) WITH CHECK (public.has_role(auth.uid(), 'dispatcher'));
CREATE POLICY "driver reads own orders" ON public.orders FOR SELECT TO authenticated
  USING (driver_id = auth.uid());
CREATE POLICY "driver updates own orders" ON public.orders FOR UPDATE TO authenticated
  USING (driver_id = auth.uid()) WITH CHECK (driver_id = auth.uid());
CREATE INDEX orders_date_idx ON public.orders (delivery_date, status);