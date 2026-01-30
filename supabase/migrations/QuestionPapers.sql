-- Create table for question papers
create table if not exists question_papers (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  college text not null,
  subject text not null,
  semester text,
  year integer,
  file_url text not null,
  uploaded_by uuid references auth.users(id) on delete cascade not null,
  downloads integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table question_papers enable row level security;

-- Policies
create policy "Public papers are viewable by everyone"
  on question_papers for select
  using ( true );

create policy "Users can upload papers"
  on question_papers for insert
  with check ( auth.uid() = uploaded_by );

-- Create storage bucket for papers if it doesn't exist
insert into storage.buckets (id, name, public)
values ('papers', 'papers', true)
on conflict (id) do nothing;

-- Storage policies
create policy "Public Access"
  on storage.objects for select
  using ( bucket_id = 'papers' );

create policy "Authenticated users can upload"
  on storage.objects for insert
  with check ( bucket_id = 'papers' and auth.role() = 'authenticated' );
