insert into public.stores (name, slug, address, capacity_small, capacity_large)
values
  ('KONCOCHII Demo Store', 'demo-store', 'Ho Chi Minh City, Vietnam', 80, 40)
on conflict (slug) do nothing;
