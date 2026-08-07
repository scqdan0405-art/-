insert into stores (code, name, area, address, lat, lng, capacity_points, open_time, close_time)
values
  ('BT', '{"en":"Ben Thanh Store","vi":"Cua hang Ben Thanh","ja":"ベンタイン店"}', 'District 1', 'Ben Thanh, District 1, Ho Chi Minh City', 10.7721, 106.6983, 20, '00:00', '24:00'),
  ('BV', '{"en":"Bui Vien Store","vi":"Cua hang Bui Vien","ja":"ブイビエン店"}', 'District 1', 'Bui Vien, District 1, Ho Chi Minh City', 10.7676, 106.6934, 20, '00:00', '24:00'),
  ('AP', '{"en":"Airport Store","vi":"Cua hang san bay","ja":"空港店"}', 'Tan Binh', 'Tan Son Nhat Airport Area, Ho Chi Minh City', 10.8188, 106.6518, 30, '00:00', '24:00')
on conflict (code) do nothing;

insert into staff (store_id, staff_code, display_name)
select id, staff_code, display_name
from stores
cross join (values
  ('0001', 'Morning Staff'),
  ('0002', 'Evening Staff')
) as s(staff_code, display_name)
on conflict (store_id, staff_code) do nothing;

insert into sales_channels (code, name, channel_type, commission_rate, supports_voucher)
values
  ('direct', 'Direct', 'direct', 0, false),
  ('google', 'Google Search', 'organic', 0, false),
  ('maps', 'Google Maps', 'organic', 0, false),
  ('trip', 'Trip.com', 'ota', 0.25, true),
  ('klook', 'Klook', 'ota', 0.25, true),
  ('kkday', 'KKday', 'ota', 0.25, true),
  ('hotel', 'Hotel referral', 'referral', 0, false),
  ('bus_tour', 'Bus tour referral', 'referral', 0, false),
  ('store_poster', 'Store poster', 'store', 0, false),
  ('sns', 'Social media', 'sns', 0, false)
on conflict (code) do nothing;

insert into price_plans (size, plan_hours, channel_tier, price_vnd, capacity_points)
values
  ('S', 3, 'direct', 50000, 1),
  ('S', 6, 'direct', 70000, 1),
  ('S', 12, 'direct', 100000, 1),
  ('M', 3, 'direct', 70000, 2),
  ('M', 6, 'direct', 100000, 2),
  ('M', 12, 'direct', 150000, 2),
  ('L', 3, 'direct', 100000, 3),
  ('L', 6, 'direct', 150000, 3),
  ('L', 12, 'direct', 200000, 3)
on conflict (size, plan_hours, channel_tier, valid_from) do nothing;

insert into fee_settings (key, value_vnd, note)
values
  ('overtime_grace_minutes', 15, 'Free grace period in minutes.'),
  ('overtime_hourly_vnd', 10000, 'Hourly overtime fee.'),
  ('overtime_cap_hours', 24, 'Cap overtime at 24 hours before daily storage applies.'),
  ('daily_storage_fee_vnd', null, 'Not decided yet; treat as 0 until configured.'),
  ('cancellation_fee_vnd', 20000, 'User cancellation fee.'),
  ('noshow_fee_vnd', 20000, 'No-show fee.'),
  ('relocate_after_days', 7, 'Days before relocating abandoned items.'),
  ('insurance_limit_item_vnd', 5000000, 'Default coverage limit per item.'),
  ('insurance_limit_booking_vnd', 10000000, 'Default coverage limit per booking.')
on conflict (key, effective_from) do nothing;
