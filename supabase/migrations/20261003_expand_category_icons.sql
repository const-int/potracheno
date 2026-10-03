-- Run once in the existing project's SQL Editor to enable the expanded icon set.
begin;
alter table public.categories drop constraint if exists categories_icon_check;
alter table public.categories add constraint categories_icon_check check (
  icon in (
    'basket','shop','car','heart','paw','home','coffee','other',
    'fuel','transport','food','clothes','travel','study','sport','gifts',
    'fun','bills','phone','work'
  )
);
commit;
