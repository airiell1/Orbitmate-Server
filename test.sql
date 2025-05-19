SELECT u.*, 
  us.theme, us.language, us.font_size, us.notifications_enabled, us.ai_model_preference,
  up.theme_preference, up.bio, up.badge, up.experience, up."level"
FROM users u
LEFT JOIN user_settings us ON u.user_id = us.user_id
LEFT JOIN user_profiles up ON u.user_id = up.user_id
WHERE u.user_id = 'A66C8382886C4EA6B57B9F1033E49EB2';