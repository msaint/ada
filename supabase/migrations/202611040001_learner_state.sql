-- Aggregate storage: one JSONB document per auth user. A compare-and-swap function
-- makes course conversion, evidence, reviews and idempotency receipts one transaction.
create table public.learner_states (
 owner_id uuid primary key references auth.users(id) on delete cascade,
 version bigint not null default 1 check (version > 0),
 data jsonb not null check (jsonb_typeof(data) = 'object'),
 updated_at timestamptz not null default now()
);
alter table public.learner_states enable row level security;
-- No direct learner access: this document contains private grading keys.
-- Backend authenticates with getUser(), then scopes all service-role queries.
-- Writes only through the function, with ownership taken from auth.uid().
revoke all on public.learner_states from anon,authenticated;
grant all on public.learner_states to service_role;
create function public.save_learner_state(requested_owner uuid, expected_version bigint, new_data jsonb)
returns bigint language plpgsql security definer set search_path = '' as $$
declare result bigint;
begin
 if requested_owner is null then raise exception 'UNAUTHORIZED'; end if;
 if octet_length(new_data::text) > 5000000 then raise exception 'STATE_TOO_LARGE'; end if;
 if expected_version = 0 then
  insert into public.learner_states(owner_id,version,data) values(requested_owner,1,new_data)
  on conflict do nothing returning version into result;
 else
  update public.learner_states set data=new_data,version=version+1,updated_at=now()
  where owner_id=requested_owner and version=expected_version returning version into result;
 end if;
 if result is null then raise exception 'VERSION_CONFLICT'; end if;
 return result;
end $$;
revoke all on function public.save_learner_state(uuid,bigint,jsonb) from public;
grant execute on function public.save_learner_state(uuid,bigint,jsonb) to service_role;
-- Self-service account deletion; removes the auth user and cascades learner data.
create function public.delete_own_account() returns void language plpgsql
security definer set search_path = '' as $$
begin
 if auth.uid() is null then raise exception 'UNAUTHORIZED'; end if;
 delete from auth.users where id=auth.uid();
end $$;
revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;
