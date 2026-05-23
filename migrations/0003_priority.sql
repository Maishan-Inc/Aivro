INSERT OR IGNORE INTO app_settings(key, value, value_type, group_name, description, is_public, updated_at)
VALUES
('QUEUE_PRIORITY_LINUXDO', '20', 'number', 'priority', 'Linux.DO 用户优先级', 0, unixepoch()),
('QUEUE_PRIORITY_GOOGLE', '10', 'number', 'priority', 'Google 用户优先级', 0, unixepoch()),
('QUEUE_PRIORITY_GUEST', '0', 'number', 'priority', '游客优先级', 0, unixepoch());
