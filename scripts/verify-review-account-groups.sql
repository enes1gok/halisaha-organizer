-- İnceleme hesabının sahibi olduğu grupları ve owner_id uyumunu listeler (salt okunur).
-- docs/group-ownership-review-account.md

with ru as (
  select id from auth.users where email = 'review.halisaha+20260507@gmail.com'
)
select g.id,
       g.name,
       g.owner_id,
       ru.id as review_uid,
       (g.owner_id = ru.id) as owner_matches_review
from public.groups g
cross join ru
where g.owner_id = ru.id;
