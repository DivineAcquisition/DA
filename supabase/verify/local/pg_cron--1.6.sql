create schema cron;

create table cron.job (
  jobid bigint generated always as identity primary key,
  schedule text not null,
  command text not null,
  nodename text not null default 'localhost',
  nodeport int not null default 5432,
  database text not null default current_database(),
  username text not null default current_user,
  active boolean not null default true,
  jobname text
);

create function cron.schedule(job_name text, schedule text, command text)
returns bigint
language sql
as $$
  insert into cron.job (jobname, schedule, command) values (job_name, schedule, command)
  returning jobid;
$$;

create function cron.schedule(schedule text, command text)
returns bigint
language sql
as $$
  insert into cron.job (schedule, command) values (schedule, command)
  returning jobid;
$$;

create function cron.unschedule(job_name text)
returns boolean
language sql
as $$
  delete from cron.job where jobname = job_name returning true;
$$;
