PRAGMA foreign_keys = ON;

INSERT INTO players (
  uuid,
  current_minecraft_name,
  discord_id,
  discord_username,
  discord_display_name,
  discord_avatar_url,
  created_at,
  updated_at
) VALUES (
  '11111111-1111-4111-8111-111111111111',
  'LegacyPlayer',
  '111111111111111111',
  'legacy-user',
  'Legacy User',
  'https://cdn.example/avatar.png',
  1788600000000,
  1788600000000
);

INSERT INTO cosmetics (id, category, name, description, icon, sort_order)
VALUES ('particle.legacy', 'particle', 'Legacy Particle', 'Created before cosmetic sync metadata existed.', NULL, 7);

INSERT INTO player_cosmetic_unlocks (player_uuid, cosmetic_id, unlocked_at, source)
VALUES ('11111111-1111-4111-8111-111111111111', 'particle.legacy', 1788600000000, 'legacy');

INSERT INTO player_equipment (player_uuid, category, cosmetic_id, updated_at)
VALUES ('11111111-1111-4111-8111-111111111111', 'particle', 'particle.legacy', 1788600000000);

INSERT INTO editions (
  number,
  name,
  status,
  published_at,
  minecraft_version,
  datapack_version,
  resource_pack_version,
  statistics_schema_version
) VALUES (4, 'Legacy edition', 'published', 1788600000000, '26.1', 'dp-legacy', 'rp-legacy', 7);

INSERT INTO edition_players (edition_id, player_uuid, minecraft_name_at_event, sgp_id)
SELECT id, '11111111-1111-4111-8111-111111111111', 'LegacyPlayer', 42
FROM editions WHERE number = 4;

INSERT INTO kit_snapshots (edition_id, kit_key, manifest_schema_version, manifest, kit_id)
SELECT id, 'legacy', 3, '{"key":"legacy"}', 3
FROM editions WHERE number = 4;

INSERT INTO auth_sessions (
  token_hash,
  discord_id,
  discord_username,
  discord_display_name,
  discord_avatar_url,
  expires_at,
  created_at
) VALUES (
  'legacy-token-hash',
  '111111111111111111',
  'legacy-user',
  'Legacy User',
  'https://cdn.example/avatar.png',
  1788700000000,
  1788600000000
);
