-- Up Migration
INSERT INTO app_permissions (id, key, description, category) VALUES
  (gen_random_uuid(), 'calendar:view', 'View calendar page', 'calendar'),
  (gen_random_uuid(), 'planning:view', 'View planning analytics pages', 'planning'),
  (gen_random_uuid(), 'backlog:view',  'View backlog page', 'backlog'),
  (gen_random_uuid(), 'chat:view',     'Access Agent Studio chat', 'chat');

-- admin gets all 4
INSERT INTO app_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM app_roles r, app_permissions p
WHERE r.name = 'admin' AND p.key IN ('calendar:view','planning:view','backlog:view','chat:view');

-- member gets all 4
INSERT INTO app_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM app_roles r, app_permissions p
WHERE r.name = 'member' AND p.key IN ('calendar:view','planning:view','backlog:view','chat:view');

-- viewer gets planning:view only (already has cost:view)
INSERT INTO app_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM app_roles r, app_permissions p
WHERE r.name = 'viewer' AND p.key = 'planning:view';

-- Down Migration
DELETE FROM app_permissions WHERE key IN ('calendar:view','planning:view','backlog:view','chat:view');
