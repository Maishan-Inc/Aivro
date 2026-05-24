INSERT OR IGNORE INTO app_settings(key, value, value_type, group_name, description, is_public, updated_at)
VALUES
('SECURITY_ALLOWED_ORIGINS', '', 'string', 'security', '逗号分隔的允许跨域来源列表；为空则只允许同源', 0, unixepoch()),
('SECURITY_CSP_REPORT_ONLY', 'false', 'string', 'security', '为 true 时 CSP 使用 Report-Only 模式', 0, unixepoch());
