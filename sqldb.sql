-- 통합 SQL 스크립트 (sqldb.sql, db_schema_update.sql, db_fixes.sql 병합)
-- 실행 순서를 고려하여 구성됨

-- 기존 테이블 및 인덱스 삭제
DROP INDEX idx_attachment_message;
DROP INDEX idx_chat_parent;
DROP INDEX idx_chat_user;
DROP INDEX idx_chat_session;
DROP INDEX idx_chat_msg_session_created;
DROP INDEX idx_chat_sessions_user;
DROP INDEX idx_users_email;

DROP TABLE attachments;
DROP TABLE user_settings;
DROP TABLE user_profiles;
DROP TABLE chat_messages;
DROP TABLE chat_sessions;
DROP TABLE users CASCADE CONSTRAINTS;

-- 테이블 생성
CREATE TABLE users (
  user_id VARCHAR2(36) DEFAULT SYS_GUID() PRIMARY KEY,
  username VARCHAR2(100) NOT NULL,
  email VARCHAR2(255) NOT NULL UNIQUE,
  password_hash VARCHAR2(255) NOT NULL,
  profile_image_path VARCHAR2(512), -- 프로필 이미지 경로 컬럼 추가
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
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE -- 사용자가 삭제되면 세션도 삭제 (또는 SET NULL)
);

-- chat_messages 테이블을 VARCHAR2(4000) 메시지 타입으로 생성 (CLOB 대신)
CREATE TABLE chat_messages (
  message_id VARCHAR2(36) DEFAULT SYS_GUID() PRIMARY KEY,
  session_id VARCHAR2(36) NOT NULL,
  user_id VARCHAR2(36), -- AI 메시지 등을 위해 NOT NULL 제약조건 제거 또는 'ai-system' 같은 특별한 ID 사용
  message_type VARCHAR2(10) NOT NULL,
  message_content CLOB NOT NULL, -- 긴 메시지 지원을 위해 CLOB 사용
  created_at TIMESTAMP DEFAULT SYSTIMESTAMP,
  reaction VARCHAR2(50),
  is_edited NUMBER(1) DEFAULT 0,
  edited_at TIMESTAMP,
  parent_message_id VARCHAR2(36),
  FOREIGN KEY (session_id) REFERENCES chat_sessions(session_id) ON DELETE CASCADE, -- 세션 삭제시 메시지 자동 삭제
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL, -- 사용자 삭제시 메시지의 user_id는 NULL로 (메시지 자체는 유지)
  FOREIGN KEY (parent_message_id) REFERENCES chat_messages(message_id) ON DELETE SET NULL -- 부모 메시지 삭제시 참조만 NULL로
);

CREATE TABLE user_settings (
  user_id VARCHAR2(36) NOT NULL PRIMARY KEY,
  theme VARCHAR2(50) DEFAULT 'light',
  language VARCHAR2(10) DEFAULT 'ko',
  font_size NUMBER(2) DEFAULT 14,
  notifications_enabled NUMBER(1) DEFAULT 1,
  ai_model_preference VARCHAR2(100),
  updated_at TIMESTAMP DEFAULT SYSTIMESTAMP, -- updated_at 컬럼 추가
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE -- 사용자 삭제시 설정도 삭제
);

CREATE TABLE attachments (
  attachment_id VARCHAR2(36) DEFAULT SYS_GUID() PRIMARY KEY,
  message_id VARCHAR2(36) NOT NULL,
  file_name VARCHAR2(255) NOT NULL,
  file_path VARCHAR2(512) NOT NULL,
  file_type VARCHAR2(100),
  file_size NUMBER,
  uploaded_at TIMESTAMP DEFAULT SYSTIMESTAMP,
  FOREIGN KEY (message_id) REFERENCES chat_messages(message_id) ON DELETE CASCADE
);

-- 사용자 프로필 테이블 추가
CREATE TABLE user_profiles (
  user_id VARCHAR2(36) NOT NULL PRIMARY KEY,
  theme_preference VARCHAR2(50) DEFAULT 'light',
  bio CLOB,
  badge VARCHAR2(100),
  experience NUMBER DEFAULT 0,
  "level" NUMBER DEFAULT 1,
  updated_at TIMESTAMP DEFAULT SYSTIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 인덱스 생성
CREATE INDEX idx_chat_session ON chat_messages(session_id);
CREATE INDEX idx_chat_user ON chat_messages(user_id);
CREATE INDEX idx_chat_parent ON chat_messages(parent_message_id);
CREATE INDEX idx_attachment_message ON attachments(message_id);
CREATE INDEX idx_chat_msg_session_created ON chat_messages (session_id, created_at);
CREATE INDEX idx_chat_sessions_user ON chat_sessions (user_id);

-- 제약 조건 추가
ALTER TABLE chat_messages DROP CONSTRAINT chk_message_type;
ALTER TABLE chat_messages ADD CONSTRAINT chk_message_type CHECK (message_type IN ('user', 'ai', 'system', 'file'));

-- 초기 사용자 데이터 추가
-- 게스트 사용자 추가
INSERT INTO users (user_id, username, email, password_hash, is_active)
VALUES ('guest', 'Guest User', 'guest@example.com', 'no_password_needed', 1);

-- 특정 사용자 정보 조회 쿼리 (A66C8382886C4EA6B57B9F1033E49EB2)
-- 이 쿼리는 사용자의 기본 정보, 설정, 프로필 정보를 모두 가져옵니다
SELECT u.*, 
  us.theme, us.language, us.font_size, us.notifications_enabled, us.ai_model_preference,
  up.theme_preference, up.bio, up.badge, up.experience, up."level"
FROM users u
LEFT JOIN user_settings us ON u.user_id = us.user_id
LEFT JOIN user_profiles up ON u.user_id = up.user_id
WHERE u.user_id = 'A66C8382886C4EA6B57B9F1033E49EB2';
-- AI 시스템 사용자 추가
-- 이 사용자는 시스템 메시지 전송을 위한 특별한 사용자로, 비밀번호는 필요 없음
INSERT INTO users (user_id, username, email, password_hash, is_active)
VALUES ('ai-system', 'AI System', 'aisystem@example.com', 'no_password', 1);

-- 테스트 계정
INSERT INTO users (user_id, username, email, password_hash)
VALUES ('test-user-frontend', 'Test Frontend User', 'testfrontend@example.com', 'dummy_password_hash');

INSERT INTO users (user_id, username, email, password_hash, is_active)
VALUES ('test-guest', 'Test Guest User', 'testguest@example.com', 'dummy_password_hash', 1);

COMMIT;
