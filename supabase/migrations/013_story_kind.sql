-- Migration 013: distinguish standard stories from emerging single-source stories

alter table stories
  add column if not exists story_kind text not null default 'standard'
    check (story_kind in ('standard', 'emerging_single_source'));

update stories
set story_kind = 'standard'
where story_kind is null;
