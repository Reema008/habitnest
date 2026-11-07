-- HabitNest: achievement catalogue (reference data, not user data).
insert into public.achievements (code, name, description, icon, sort_order) values
  ('first_entry',        'First Step',         'Recorded your very first habit entry.',         'sprout',          1),
  ('first_custom_habit', 'Habit Designer',     'Created your own custom habit.',                'wand-sparkles',   2),
  ('joined_family',      'Nest Mate',          'Joined a family nest.',                         'house-heart',     3),
  ('streak_3',           'Warming Up',         'Completed a habit 3 scheduled days in a row.',  'flame',           4),
  ('streak_7',           'One Week Strong',    'Completed a habit 7 scheduled days in a row.',  'flame-kindling',  5),
  ('streak_30',          'Monthly Marvel',     'Completed a habit 30 scheduled days in a row.', 'trophy',          6),
  ('perfect_day',        'Perfect Day',        'Completed every habit scheduled for a day.',    'sun',             7),
  ('complete_10',        'Getting Consistent', 'Completed 10 habit goals.',                     'star',            8),
  ('complete_50',        'Steady Spirit',      'Completed 50 habit goals.',                     'sparkles',        9),
  ('complete_100',       'Century Club',       'Completed 100 habit goals.',                    'medal',          10),
  ('active_30_days',     'Showing Up',         'Tracked habits on 30 different days.',          'calendar-check', 11)
on conflict (code) do update
  set name = excluded.name, description = excluded.description,
      icon = excluded.icon, sort_order = excluded.sort_order;
