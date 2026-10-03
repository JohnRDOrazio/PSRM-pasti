-- Besides guests, the kitchen also counts the "Propedeutico" (Propd) per meal. Both are plain
-- per-meal headcounts set by an admin, so they share meal_guests, told apart by kind.
create type extra_kind_t as enum ('guests', 'propd');
alter table meal_guests add column kind extra_kind_t not null default 'guests';
alter table meal_guests drop constraint meal_guests_pkey;
alter table meal_guests add primary key (date, meal, kind);
