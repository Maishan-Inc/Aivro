INSERT OR IGNORE INTO app_settings(key, value, value_type, group_name, description, is_public, updated_at)
VALUES
('CAPTCHA_ENABLED', 'false', 'boolean', 'captcha', 'Enable human verification for write endpoints', 1, unixepoch()),
('CAPTCHA_PROVIDER', 'turnstile', 'string', 'captcha', 'Captcha provider: turnstile or hcaptcha', 1, unixepoch()),
('CAPTCHA_SITE_KEY', '', 'string', 'captcha', 'Public site key shown to the browser', 1, unixepoch());
