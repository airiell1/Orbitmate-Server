CREATE TABLE users (
  user_id VARCHAR2(36) DEFAULT SYS_GUID() PRIMARY KEY,
  username VARCHAR2(100) NOT NULL,
  email VARCHAR2(255) NOT NULL UNIQUE,
  password_hash VARCHAR2(255) NOT NULL,
  created_at TIMESTAMP DEFAULT SYSTIMESTAMP,
  last_login TIMESTAMP,
  is_active NUMBER(1) DEFAULT 1
);

CREATE TABLE chat_sessions (
  session_id VARCHAR2(36) DEFAULT SYS_GUID() PRIMARY KEY,
  user_id VARCHAR2(36) NOT NULL,
  title VARCHAR2(255) NOT NULL,
  created_at TIMESTAMP DEFAULT SYSTIMESTAMP,
  updated_at TIMESTAMP DEFAULT SYSTIMESTAMP,
  is_archived NUMBER(1) DEFAULT 0,
  category VARCHAR2(100),
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE TABLE chat_messages (
  message_id VARCHAR2(36) DEFAULT SYS_GUID() PRIMARY KEY,
  session_id VARCHAR2(36) NOT NULL,
  user_id VARCHAR2(36) NOT NULL,
  message_type VARCHAR2(10) NOT NULL,
  message_content CLOB NOT NULL,
  created_at TIMESTAMP DEFAULT SYSTIMESTAMP,
  reaction VARCHAR2(50),
  is_edited NUMBER(1) DEFAULT 0,
  edited_at TIMESTAMP,
  parent_message_id VARCHAR2(36),
  FOREIGN KEY (session_id) REFERENCES chat_sessions(session_id),
  FOREIGN KEY (user_id) REFERENCES users(user_id),
  FOREIGN KEY (parent_message_id) REFERENCES chat_messages(message_id)
);

CREATE TABLE user_settings (
  user_id VARCHAR2(36) NOT NULL PRIMARY KEY,
  theme VARCHAR2(50) DEFAULT 'light',
  language VARCHAR2(10) DEFAULT 'ko',
  font_size NUMBER(2) DEFAULT 14,
  notifications_enabled NUMBER(1) DEFAULT 1,
  ai_model_preference VARCHAR2(100),
  created_at TIMESTAMP DEFAULT SYSTIMESTAMP,
  updated_at TIMESTAMP DEFAULT SYSTIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE TABLE attachments (
  attachment_id VARCHAR2(36) DEFAULT SYS_GUID() PRIMARY KEY,
  message_id VARCHAR2(36) NOT NULL,
  file_name VARCHAR2(255) NOT NULL,
  file_type VARCHAR2(100) NOT NULL,
  file_size NUMBER NOT NULL,
  file_path VARCHAR2(500) NOT NULL,
  uploaded_at TIMESTAMP DEFAULT SYSTIMESTAMP,
  FOREIGN KEY (message_id) REFERENCES chat_messages(message_id)
);

CREATE INDEX idx_chat_session ON chat_messages(session_id);
CREATE INDEX idx_chat_user ON chat_messages(user_id);
CREATE INDEX idx_chat_parent ON chat_messages(parent_message_id);
CREATE INDEX idx_attachment_message ON attachments(message_id);
CREATE INDEX idx_chat_msg_session_created ON chat_messages (session_id, created_at);
CREATE INDEX idx_chat_sessions_user ON chat_sessions (user_id);
CREATE INDEX idx_users_email ON users (email);

ALTER TABLE chat_messages ADD CONSTRAINT chk_message_type CHECK (message_type IN ('user', 'ai', 'system'));



-- 테스트 계정
INSERT INTO users (user_id, username, email, password_hash)
VALUES ('test-user-frontend', 'Test Frontend User', 'testfrontend@example.com', 'dummy_password_hash');
COMMIT;