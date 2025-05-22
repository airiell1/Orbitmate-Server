SELECT u.*, 
  us.theme, us.language, us.font_size, us.notifications_enabled, us.ai_model_preference,
  up.theme_preference, up.bio, up.badge, up.experience, up."level"
FROM users u
LEFT JOIN user_settings us ON u.user_id = us.user_id
LEFT JOIN user_profiles up ON u.user_id = up.user_id
WHERE u.user_id = 'A66C8382886C4EA6B57B9F1033E49EB2';

SET FOREIGN_KEY_CHECKS = 0;
SET @tables = NULL;
SELECT GROUP_CONCAT(table_schema, '.', table_name) INTO @tables
    FROM information_schema.tables
    WHERE table_schema = 'orbitmate';
SET @tables = CONCAT('DROP TABLE ', @tables);
PREPARE stmt FROM @tables;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;