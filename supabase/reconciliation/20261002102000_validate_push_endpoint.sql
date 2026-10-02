-- Push workers send to stored endpoints with privileged network access.
-- Accept HTTPS endpoints from browser push services, never caller-chosen hosts.
-- This also covers direct table writes and preserves every existing row.
alter table public.study_push_subscriptions
  add constraint study_push_subscription_trusted_endpoint
  check (endpoint ~* '^https://(fcm[.]googleapis[.]com|updates[.]push[.]services[.]mozilla[.]com|push[.]services[.]mozilla[.]com|([a-z0-9-]+[.])*push[.]apple[.]com|([a-z0-9-]+[.])*notify[.]windows[.]com)(/|$)')
  not valid;

alter table public.study_push_subscriptions
  validate constraint study_push_subscription_trusted_endpoint;
