-- Create profiles table linked to Supabase Auth users
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text unique not null,
  name text,
  is_whitelisted boolean default true,
  created_at timestamptz default now()
);

-- Enable RLS on profiles
alter table public.profiles enable row level security;

create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Create loans table
create table public.loans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  lender text not null,
  loan_type text not null,
  principal numeric(15, 2) not null,
  current_balance numeric(15, 2) not null,
  interest_rate numeric(5, 2) not null,
  emi numeric(15, 2) not null,
  start_date date not null,
  end_date date not null,
  due_day integer not null check (due_day >= 1 and due_day <= 31),
  status text not null default 'active' check (status in ('active', 'closed')),
  priority text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  notes text,
  created_at timestamptz default now()
);

alter table public.loans enable row level security;

create policy "Users can view their own loans"
  on public.loans for select
  using (auth.uid() = user_id);

create policy "Users can insert their own loans"
  on public.loans for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own loans"
  on public.loans for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own loans"
  on public.loans for delete
  using (auth.uid() = user_id);

-- Create loan_payments table
create table public.loan_payments (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid references public.loans(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  amount numeric(15, 2) not null,
  payment_date date not null default current_date,
  status text not null default 'paid' check (status in ('paid', 'pending', 'overdue')),
  created_at timestamptz default now()
);

alter table public.loan_payments enable row level security;

create policy "Users can view their own loan payments"
  on public.loan_payments for select
  using (auth.uid() = user_id);

create policy "Users can insert their own loan payments"
  on public.loan_payments for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own loan payments"
  on public.loan_payments for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own loan payments"
  on public.loan_payments for delete
  using (auth.uid() = user_id);

-- Create credit_cards table
create table public.credit_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  card_name text not null,
  bank text not null,
  credit_limit numeric(15, 2) not null,
  current_utilization numeric(15, 2) not null default 0 check (current_utilization >= 0),
  minimum_due numeric(15, 2) not null default 0 check (minimum_due >= 0),
  statement_date integer not null check (statement_date >= 1 and statement_date <= 31),
  due_date integer not null check (due_date >= 1 and due_date <= 31),
  annual_fee numeric(10, 2) not null default 0,
  status text not null default 'active',
  created_at timestamptz default now()
);

alter table public.credit_cards enable row level security;

create policy "Users can view their own credit cards"
  on public.credit_cards for select
  using (auth.uid() = user_id);

create policy "Users can insert their own credit cards"
  on public.credit_cards for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own credit cards"
  on public.credit_cards for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own credit cards"
  on public.credit_cards for delete
  using (auth.uid() = user_id);

-- Create credit_card_payments table
create table public.credit_card_payments (
  id uuid primary key default gen_random_uuid(),
  credit_card_id uuid references public.credit_cards(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  amount numeric(15, 2) not null,
  payment_date date not null default current_date,
  created_at timestamptz default now()
);

alter table public.credit_card_payments enable row level security;

create policy "Users can view their own credit card payments"
  on public.credit_card_payments for select
  using (auth.uid() = user_id);

create policy "Users can insert their own credit card payments"
  on public.credit_card_payments for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own credit card payments"
  on public.credit_card_payments for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own credit card payments"
  on public.credit_card_payments for delete
  using (auth.uid() = user_id);

-- Create income_entries table
create table public.income_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  source text not null check (source in ('Salary', 'Freelancing', 'Part Time', 'Business', 'Other')),
  expected_amount numeric(15, 2) not null,
  received_amount numeric(15, 2) not null default 0,
  status text not null default 'pending' check (status in ('expected', 'received', 'pending')),
  entry_date date not null default current_date,
  created_at timestamptz default now()
);

alter table public.income_entries enable row level security;

create policy "Users can view their own income entries"
  on public.income_entries for select
  using (auth.uid() = user_id);

create policy "Users can insert their own income entries"
  on public.income_entries for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own income entries"
  on public.income_entries for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own income entries"
  on public.income_entries for delete
  using (auth.uid() = user_id);

-- Create expense_entries table
create table public.expense_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  category text not null check (category in ('Home', 'Food', 'Travel', 'Bills', 'Entertainment', 'Shopping', 'Medical', 'Education', 'Other')),
  amount numeric(15, 2) not null,
  entry_date date not null default current_date,
  description text,
  credit_card_id uuid references public.credit_cards(id) on delete set null,
  created_at timestamptz default now()
);

alter table public.expense_entries enable row level security;

create policy "Users can view their own expense entries"
  on public.expense_entries for select
  using (auth.uid() = user_id);

create policy "Users can insert their own expense entries"
  on public.expense_entries for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own expense entries"
  on public.expense_entries for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own expense entries"
  on public.expense_entries for delete
  using (auth.uid() = user_id);

-- Create goals table
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  target_amount numeric(15, 2) not null,
  current_amount numeric(15, 2) not null default 0,
  target_date date not null,
  required_monthly_reduction numeric(15, 2) not null,
  created_at timestamptz default now()
);

alter table public.goals enable row level security;

create policy "Users can view their own goals"
  on public.goals for select
  using (auth.uid() = user_id);

create policy "Users can insert their own goals"
  on public.goals for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own goals"
  on public.goals for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own goals"
  on public.goals for delete
  using (auth.uid() = user_id);

-- Create advisor_logs table
create table public.advisor_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  query text not null,
  response text not null,
  type text not null default 'general',
  created_at timestamptz default now()
);

alter table public.advisor_logs enable row level security;

create policy "Users can view their own advisor logs"
  on public.advisor_logs for select
  using (auth.uid() = user_id);

create policy "Users can insert their own advisor logs"
  on public.advisor_logs for insert
  with check (auth.uid() = user_id);

-- Create notifications table
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  type text not null,
  title text not null,
  message text not null,
  read boolean not null default false,
  created_at timestamptz default now()
);

alter table public.notifications enable row level security;

create policy "Users can view their own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

create policy "Users can update their own notifications"
  on public.notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Create settings table
create table public.settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  key text not null,
  value jsonb not null,
  created_at timestamptz default now(),
  unique (user_id, key)
);

alter table public.settings enable row level security;

create policy "Users can view their own settings"
  on public.settings for select
  using (auth.uid() = user_id);

create policy "Users can insert/update their own settings"
  on public.settings for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own settings_update"
  on public.settings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Create audit_logs table
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  action text not null,
  details jsonb,
  created_at timestamptz default now()
);

alter table public.audit_logs enable row level security;

create policy "Users can view their own audit logs"
  on public.audit_logs for select
  using (auth.uid() = user_id);

create policy "System can write audit logs"
  on public.audit_logs for insert
  with check (true);

-- Auth Trigger to Automatically Create Profiles for New Users
create or replace function public.handle_new_user()
returns trigger
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, is_whitelisted)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    true
  );
  return new;
end;
$$ language plpgsql;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
