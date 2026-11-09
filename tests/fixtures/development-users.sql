-- Include only inside a transaction that is always rolled back.
insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-000000000001','owner@example.invalid'),
 ('00000000-0000-4000-8000-000000000002','other@example.invalid');
