-- 오비메이트 통합 DB 초기화 스크립트
-- 기본 스키마 + 구독 관리 + 레벨 시스템 + 다국어 지원 등 모든 기능 포함
-- 2025년 1월 27일: db_enhancement.sql 통합 완료
-- 실행 순서를 고려하여 구성됨

-- 기존 테이블 및 인덱스 삭제 (확장 테이블 포함)
DROP INDEX idx_subscription_tiers_level;
DROP INDEX idx_subscription_tiers_active;
DROP INDEX idx_user_subscriptions_user;
DROP INDEX idx_user_subscriptions_active;
DROP INDEX idx_user_subscriptions_dates;
DROP INDEX idx_user_badges_user;
DROP INDEX idx_user_badges_equipped;
DROP INDEX idx_user_exp_log_user;
DROP INDEX idx_user_exp_log_date;
DROP INDEX idx_user_items_user;
DROP INDEX idx_user_items_active;
DROP INDEX idx_message_edit_message;
DROP INDEX idx_translation_lang;
DROP INDEX idx_translation_key;
DROP INDEX idx_attachment_message;
DROP INDEX idx_chat_parent;
DROP INDEX idx_chat_user;
DROP INDEX idx_chat_session;
DROP INDEX idx_chat_msg_session_created;
DROP INDEX idx_chat_sessions_user;
DROP INDEX idx_users_email;

DROP TABLE feedback_reports;
DROP TABLE bug_reports;
DROP TABLE translation_resources;
DROP TABLE message_edit_history;
DROP TABLE user_items;
DROP TABLE user_experience_log;
DROP TABLE level_requirements;
DROP TABLE user_badges;
DROP TABLE user_subscriptions;
DROP TABLE subscription_tiers;
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
  user_message_token_count NUMBER, -- ✨ 사용자 메시지 토큰 수 컬럼 추가
  ai_message_token_count NUMBER,   -- ✨ AI 메시지 토큰 수 컬럼 추가
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

-- 사용자 프로필 테이블 추가 (프로필 꾸미기 기능 포함)
CREATE TABLE user_profiles (
  user_id VARCHAR2(36) NOT NULL PRIMARY KEY,
  theme_preference VARCHAR2(50) DEFAULT 'light',
  bio CLOB,
  badge VARCHAR2(100),
  experience NUMBER DEFAULT 0,
  "level" NUMBER DEFAULT 1,
  updated_at TIMESTAMP DEFAULT SYSTIMESTAMP,
  -- 프로필 꾸미기 관련 컬럼 추가
  nickname VARCHAR2(100), -- 사용자 닉네임
  birth_date DATE,         -- 생년월일
  gender VARCHAR2(10),     -- 성별
  introduction CLOB,       -- 자기소개
  profile_theme VARCHAR2(50) DEFAULT 'default', -- 프로필 테마
  profile_border VARCHAR2(50) DEFAULT 'none',   -- 프로필 테두리
  profile_background VARCHAR2(100),             -- 프로필 배경
  status_message VARCHAR2(200),                 -- 상태 메시지
  experience_multiplier NUMBER(3,2) DEFAULT 1.0, -- 경험치 배수 (아이템 효과)
  premium_until TIMESTAMP,                      -- 플래닛 만료일
  is_premium NUMBER(1) DEFAULT 0,               -- 플래닛 여부
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 구독 등급 정보 테이블
CREATE TABLE subscription_tiers (
    tier_id VARCHAR2(36) DEFAULT SYS_GUID() PRIMARY KEY,
    tier_name VARCHAR2(50) NOT NULL UNIQUE, -- 'free', 'planet', 'star', 'galaxy'
    tier_display_name VARCHAR2(100) NOT NULL, -- '오비메이트 코멧', '오비메이트 플래닛' 등
    tier_emoji VARCHAR2(10), -- '☄️', '🪐', '☀️', '🌌'
    monthly_price NUMBER(10,2), -- 월 요금 (원 단위)
    yearly_price NUMBER(10,2), -- 연 요금 (원 단위, 할인 적용)
    tier_level NUMBER NOT NULL, -- 등급 레벨 (0: 무료, 1: 플래닛, 2: 스타, 3: 갤럭시)
    max_ai_requests_per_day NUMBER, -- 일일 AI 요청 제한 (NULL = 무제한)
    max_file_upload_size NUMBER, -- 파일 업로드 크기 제한 (MB)
    features_included CLOB, -- JSON 형태의 포함 기능 목록
    is_enterprise NUMBER(1) DEFAULT 0, -- 기업용 여부
    is_active NUMBER(1) DEFAULT 1, -- 활성 상태
    created_at TIMESTAMP DEFAULT SYSTIMESTAMP,
    updated_at TIMESTAMP DEFAULT SYSTIMESTAMP
);

-- 사용자 구독 정보 테이블
CREATE TABLE user_subscriptions (
    subscription_id VARCHAR2(36) DEFAULT SYS_GUID() PRIMARY KEY,
    user_id VARCHAR2(36) NOT NULL,
    tier_id VARCHAR2(36) NOT NULL,
    subscription_start TIMESTAMP DEFAULT SYSTIMESTAMP,
    subscription_end TIMESTAMP,
    is_active NUMBER(1) DEFAULT 1,
    payment_method VARCHAR2(50), -- '카드', '계좌이체', '기업계약' 등
    auto_renewal NUMBER(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT SYSTIMESTAMP,
    updated_at TIMESTAMP DEFAULT SYSTIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (tier_id) REFERENCES subscription_tiers(tier_id)
);

-- 뱃지 시스템 테이블
CREATE TABLE user_badges (
    badge_id VARCHAR2(36) DEFAULT SYS_GUID() PRIMARY KEY,
    user_id VARCHAR2(36) NOT NULL,
    badge_type VARCHAR2(50) NOT NULL, -- 'achievement', 'premium', 'special', 'event'
    badge_name VARCHAR2(100) NOT NULL,
    badge_description VARCHAR2(500),
    badge_icon VARCHAR2(200), -- 아이콘 경로 또는 이모지
    badge_color VARCHAR2(7) DEFAULT '#808080', -- 뱃지 색상 (hex)
    badge_level NUMBER DEFAULT 1, -- 뱃지 레벨 (버그 제보, 피드백 등으로 증가)
    is_equipped NUMBER(1) DEFAULT 0, -- 착용 여부
    earned_at TIMESTAMP DEFAULT SYSTIMESTAMP,
    updated_at TIMESTAMP DEFAULT SYSTIMESTAMP, -- 뱃지 레벨 업데이트 시간
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 레벨 시스템 테이블 (레벨별 필요 경험치 정의)
CREATE TABLE level_requirements (
    level_num NUMBER PRIMARY KEY,
    required_exp NUMBER NOT NULL,
    level_name VARCHAR2(50),
    level_description VARCHAR2(200),
    unlock_features CLOB, -- JSON 형태로 해금되는 기능들
    level_badge VARCHAR2(100), -- 레벨 달성 시 지급되는 뱃지
    created_at TIMESTAMP DEFAULT SYSTIMESTAMP
);

-- 사용자 경험치 기록 테이블 (경험치 획득 내역)
CREATE TABLE user_experience_log (
    log_id VARCHAR2(36) DEFAULT SYS_GUID() PRIMARY KEY,
    user_id VARCHAR2(36) NOT NULL,
    exp_type VARCHAR2(50) NOT NULL, -- 'chat', 'login', 'achievement', 'daily_bonus', 'item_use'
    exp_amount NUMBER NOT NULL,
    exp_reason VARCHAR2(200),
    old_total_exp NUMBER,
    new_total_exp NUMBER,
    old_level NUMBER,
    new_level NUMBER,
    multiplier_applied NUMBER(3,2) DEFAULT 1.0, -- 적용된 배수
    earned_at TIMESTAMP DEFAULT SYSTIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 아이템 시스템 테이블 (경험치 부스터, 테마 등)
CREATE TABLE user_items (
    item_id VARCHAR2(36) DEFAULT SYS_GUID() PRIMARY KEY,
    user_id VARCHAR2(36) NOT NULL,
    item_type VARCHAR2(50) NOT NULL, -- 'exp_booster', 'theme', 'border', 'background'
    item_name VARCHAR2(100) NOT NULL,
    item_description VARCHAR2(500),
    item_effect CLOB, -- JSON 형태의 아이템 효과
    quantity NUMBER DEFAULT 1,
    is_active NUMBER(1) DEFAULT 0, -- 활성화 여부
    obtained_at TIMESTAMP DEFAULT SYSTIMESTAMP,
    expires_at TIMESTAMP, -- 만료일 (임시 아이템용)
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 메시지 편집 기록 테이블
CREATE TABLE message_edit_history (
    edit_id VARCHAR2(36) DEFAULT SYS_GUID() PRIMARY KEY,
    message_id VARCHAR2(36) NOT NULL,
    old_content CLOB,
    new_content CLOB,
    edit_reason VARCHAR2(200),
    edited_by VARCHAR2(36), -- 편집한 사용자 ID
    edited_at TIMESTAMP DEFAULT SYSTIMESTAMP,
    FOREIGN KEY (message_id) REFERENCES chat_messages(message_id) ON DELETE CASCADE,
    FOREIGN KEY (edited_by) REFERENCES users(user_id) ON DELETE SET NULL
);

-- 다국어 번역 리소스 테이블
CREATE TABLE translation_resources (
    translation_id VARCHAR2(36) DEFAULT SYS_GUID() PRIMARY KEY,
    lang_code VARCHAR2(10) NOT NULL, -- 'ko', 'en', 'ja', 'zh'
    resource_key VARCHAR2(200) NOT NULL,
    resource_value CLOB NOT NULL,
    category VARCHAR2(50), -- 'ui', 'message', 'error', 'notification'
    updated_at TIMESTAMP DEFAULT SYSTIMESTAMP
);

-- 버그 제보 테이블
CREATE TABLE bug_reports (
  report_id VARCHAR2(36) DEFAULT SYS_GUID() PRIMARY KEY,
  user_id VARCHAR2(36) NOT NULL,
  title VARCHAR2(200) NOT NULL,
  description CLOB NOT NULL,
  severity VARCHAR2(20) DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  category VARCHAR2(50) DEFAULT 'general',  -- 'ui', 'api', 'performance', 'security', 'general'
  browser_info CLOB,  -- 브라우저/환경 정보 JSON
  steps_to_reproduce CLOB,  -- 재현 단계
  expected_behavior CLOB,  -- 예상 동작
  actual_behavior CLOB,  -- 실제 동작
  status VARCHAR2(20) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed', 'duplicate')),
  priority VARCHAR2(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  assigned_to VARCHAR2(36),  -- 담당자 ID (관리자/개발자)
  resolution_notes CLOB,  -- 해결 방법/내용
  attachment_urls CLOB,  -- 첨부파일 URL들 (JSON 배열)
  created_at DATE DEFAULT SYSDATE,
  updated_at DATE DEFAULT SYSDATE,
  resolved_at DATE,
  CONSTRAINT fk_bug_reports_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
);

-- 피드백 및 제안 테이블
CREATE TABLE feedback_reports (
  feedback_id VARCHAR2(36) DEFAULT SYS_GUID() PRIMARY KEY,
  user_id VARCHAR2(36) NOT NULL,
  title VARCHAR2(200) NOT NULL,
  content CLOB NOT NULL,
  feedback_type VARCHAR2(30) DEFAULT 'general' CHECK (feedback_type IN ('feature_request', 'improvement', 'general', 'ui_ux', 'performance', 'content')),
  category VARCHAR2(50) DEFAULT 'general',  -- 'chat', 'search', 'ui', 'mobile', 'api', 'general'
  upvotes NUMBER DEFAULT 0,  -- 다른 사용자들의 추천수
  downvotes NUMBER DEFAULT 0,  -- 비추천수
  status VARCHAR2(20) DEFAULT 'submitted' CHECK (status IN ('submitted', 'under_review', 'planned', 'in_development', 'completed', 'rejected')),
  priority VARCHAR2(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  admin_response CLOB,  -- 관리자 응답
  implementation_notes CLOB,  -- 구현 관련 메모
  attachment_urls CLOB,  -- 첨부파일 URL들 (JSON 배열)
  created_at DATE DEFAULT SYSDATE,
  updated_at DATE DEFAULT SYSDATE,
  reviewed_at DATE,
  CONSTRAINT fk_feedback_reports_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
);

-- 인덱스 생성 (기본 + 확장)
CREATE INDEX idx_chat_session ON chat_messages(session_id);
CREATE INDEX idx_chat_user ON chat_messages(user_id);
CREATE INDEX idx_chat_parent ON chat_messages(parent_message_id);
CREATE INDEX idx_attachment_message ON attachments(message_id);
CREATE INDEX idx_chat_msg_session_created ON chat_messages (session_id, created_at);
CREATE INDEX idx_chat_sessions_user ON chat_sessions (user_id);

-- 확장 테이블 인덱스
CREATE INDEX idx_subscription_tiers_level ON subscription_tiers(tier_level);
CREATE INDEX idx_subscription_tiers_active ON subscription_tiers(is_active);
CREATE INDEX idx_user_subscriptions_user ON user_subscriptions(user_id);
CREATE INDEX idx_user_subscriptions_active ON user_subscriptions(user_id, is_active);
CREATE INDEX idx_user_subscriptions_dates ON user_subscriptions(subscription_start, subscription_end);
CREATE INDEX idx_user_badges_user ON user_badges(user_id);
CREATE INDEX idx_user_badges_equipped ON user_badges(user_id, is_equipped);
CREATE INDEX idx_user_exp_log_user ON user_experience_log(user_id);
CREATE INDEX idx_user_exp_log_date ON user_experience_log(earned_at);
CREATE INDEX idx_user_items_user ON user_items(user_id);
CREATE INDEX idx_user_items_active ON user_items(user_id, is_active);
CREATE INDEX idx_message_edit_message ON message_edit_history(message_id);
CREATE INDEX idx_translation_lang ON translation_resources(lang_code);
CREATE INDEX idx_translation_key ON translation_resources(lang_code, resource_key);

-- 버그 제보 및 피드백 테이블 인덱스
CREATE INDEX idx_bug_reports_user ON bug_reports(user_id);
CREATE INDEX idx_bug_reports_status ON bug_reports(status);
CREATE INDEX idx_bug_reports_severity ON bug_reports(severity, status);
CREATE INDEX idx_bug_reports_created ON bug_reports(created_at);
CREATE INDEX idx_feedback_reports_user ON feedback_reports(user_id);
CREATE INDEX idx_feedback_reports_status ON feedback_reports(status);
CREATE INDEX idx_feedback_reports_type ON feedback_reports(feedback_type);
CREATE INDEX idx_feedback_reports_created ON feedback_reports(created_at);

-- 제약 조건 추가
ALTER TABLE chat_messages ADD CONSTRAINT chk_message_type CHECK (message_type IN ('user', 'ai', 'system', 'file'));

-- 초기 데이터 삽입

-- 구독 등급 기본 데이터 삽입
INSERT INTO subscription_tiers (tier_name, tier_display_name, tier_emoji, monthly_price, yearly_price, tier_level, max_ai_requests_per_day, max_file_upload_size, features_included, is_enterprise) VALUES
('free', '오비메이트 코멧', '☄️', 0, 0, 0, 30, 10, '["basic_chat", "profile_edit", "basic_search", "wikipedia_search"]', 0);

INSERT INTO subscription_tiers (tier_name, tier_display_name, tier_emoji, monthly_price, yearly_price, tier_level, max_ai_requests_per_day, max_file_upload_size, features_included, is_enterprise) VALUES
('planet', '오비메이트 플래닛', '🪐', 15000, 150000, 1, 1000, 50, '["unlimited_chat", "advanced_ai_models", "file_upload", "premium_search", "weather_widget", "custom_themes", "message_edit", "reaction_features"]', 0);

INSERT INTO subscription_tiers (tier_name, tier_display_name, tier_emoji, monthly_price, yearly_price, tier_level, max_ai_requests_per_day, max_file_upload_size, features_included, is_enterprise) VALUES
('star', '오비메이트 스타', '☀️', 150000, 1500000, 2, NULL, 200, '["unlimited_everything", "priority_support", "advanced_analytics", "api_access", "custom_integrations", "exclusive_models", "beta_features", "premium_widgets"]', 0);

INSERT INTO subscription_tiers (tier_name, tier_display_name, tier_emoji, monthly_price, yearly_price, tier_level, max_ai_requests_per_day, max_file_upload_size, features_included, is_enterprise) VALUES
('galaxy', '오비메이트 갤럭시', '🌌', 3000000, 30000000, 3, NULL, 1000, '["enterprise_features", "dedicated_support", "custom_deployment", "advanced_security", "user_management", "analytics_dashboard", "api_unlimited", "white_labeling"]', 1);

-- 기본 레벨 데이터 삽입
INSERT INTO level_requirements (level_num, required_exp, level_name, level_description, unlock_features) VALUES
(1, 0, '새싹 오비터', 'Orbitmate를 시작한 신규 사용자', '["basic_chat", "profile_edit"]');

INSERT INTO level_requirements (level_num, required_exp, level_name, level_description, unlock_features) VALUES
(2, 100, '초보 오비터', '기본 대화를 익힌 사용자', '["reaction_add", "message_edit"]');

INSERT INTO level_requirements (level_num, required_exp, level_name, level_description, unlock_features) VALUES
(3, 300, '활동적 오비터', '활발하게 대화하는 사용자', '["file_upload", "session_create"]');

INSERT INTO level_requirements (level_num, required_exp, level_name, level_description, unlock_features) VALUES
(4, 600, '숙련된 오비터', '다양한 기능을 활용하는 사용자', '["advanced_prompts", "search_features"]');

INSERT INTO level_requirements (level_num, required_exp, level_name, level_description, unlock_features) VALUES
(5, 1000, '전문 오비터', '오비메이트 전문가', '["custom_themes", "premium_features"]');

INSERT INTO level_requirements (level_num, required_exp, level_name, level_description, unlock_features) VALUES
(10, 3000, '마스터 오비터', '오비메이트 마스터', '["all_features", "special_badges"]');

INSERT INTO level_requirements (level_num, required_exp, level_name, level_description, unlock_features) VALUES
(15, 6000, '레전드 오비터', '전설적인 사용자', '["legendary_status", "unique_rewards"]');

INSERT INTO level_requirements (level_num, required_exp, level_name, level_description, unlock_features) VALUES
(20, 10000, '오비메이트 신', '최고 레벨 달성자', '["god_mode", "exclusive_content"]');

-- 기본 번역 리소스 (한국어, 영어)
INSERT INTO translation_resources (lang_code, resource_key, resource_value, category) VALUES
('ko', 'welcome_message', '오비메이트에 오신 것을 환영합니다!', 'ui');

INSERT INTO translation_resources (lang_code, resource_key, resource_value, category) VALUES
('en', 'welcome_message', 'Welcome to Orbitmate!', 'ui');

INSERT INTO translation_resources (lang_code, resource_key, resource_value, category) VALUES
('ko', 'level_up', '레벨업! 새로운 기능이 해금되었습니다.', 'notification');

INSERT INTO translation_resources (lang_code, resource_key, resource_value, category) VALUES
('en', 'level_up', 'Level up! New features unlocked.', 'notification');

INSERT INTO translation_resources (lang_code, resource_key, resource_value, category) VALUES
('ko', 'profile_updated', '프로필이 업데이트되었습니다.', 'message');

INSERT INTO translation_resources (lang_code, resource_key, resource_value, category) VALUES
('en', 'profile_updated', 'Profile has been updated.', 'message');

INSERT INTO translation_resources (lang_code, resource_key, resource_value, category) VALUES
('ko', 'badge_earned', '새로운 뱃지를 획득했습니다!', 'notification');

INSERT INTO translation_resources (lang_code, resource_key, resource_value, category) VALUES
('en', 'badge_earned', 'You earned a new badge!', 'notification');
-- 테스트 사용자 생성 (중복 방지)
-- 게스트 사용자 추가
MERGE INTO users u
USING (SELECT 'guest' as user_id, 'Guest User' as username, 'guest@example.com' as email, 'no_password_needed' as password_hash, 1 as is_active FROM dual) src
ON (u.user_id = src.user_id)
WHEN NOT MATCHED THEN
  INSERT (user_id, username, email, password_hash, is_active)
  VALUES (src.user_id, src.username, src.email, src.password_hash, src.is_active);

-- AI 시스템 사용자 추가
MERGE INTO users u
USING (SELECT 'ai-system' as user_id, 'AI System' as username, 'aisystem@example.com' as email, 'no_password' as password_hash, 1 as is_active FROM dual) src
ON (u.user_id = src.user_id)
WHEN NOT MATCHED THEN
  INSERT (user_id, username, email, password_hash, is_active)
  VALUES (src.user_id, src.username, src.email, src.password_hash, src.is_active);

-- 테스트 계정들
MERGE INTO users u
USING (SELECT 'test-user-frontend' as user_id, 'Test Frontend User' as username, 'testfrontend@example.com' as email, 'dummy_password_hash' as password_hash FROM dual) src
ON (u.user_id = src.user_id)
WHEN NOT MATCHED THEN
  INSERT (user_id, username, email, password_hash)
  VALUES (src.user_id, src.username, src.email, src.password_hash);

MERGE INTO users u
USING (SELECT 'test-guest' as user_id, 'Test Guest User' as username, 'testguest@example.com' as email, 'dummy_password_hash' as password_hash, 1 as is_active FROM dual) src
ON (u.user_id = src.user_id)
WHEN NOT MATCHED THEN
  INSERT (user_id, username, email, password_hash, is_active)
  VALUES (src.user_id, src.username, src.email, src.password_hash, src.is_active);

-- guest 사용자 기본 설정 및 프로필 생성 (중복 방지)
MERGE INTO user_settings us
USING (SELECT 'guest' as user_id, 'light' as theme, 'ko' as language, 'geminiapi' as ai_model_preference FROM dual) src
ON (us.user_id = src.user_id)
WHEN NOT MATCHED THEN
  INSERT (user_id, theme, language, ai_model_preference)
  VALUES (src.user_id, src.theme, src.language, src.ai_model_preference);

MERGE INTO user_profiles up
USING (SELECT 'guest' as user_id, 'Guest' as nickname, '안녕하세요! 오비메이트를 체험하고 있는 게스트 사용자입니다.' as introduction, 'default' as profile_theme, 150 as experience, 2 as level_num FROM dual) src
ON (up.user_id = src.user_id)
WHEN NOT MATCHED THEN
  INSERT (user_id, nickname, introduction, profile_theme, experience, "level")
  VALUES (src.user_id, src.nickname, src.introduction, src.profile_theme, src.experience, src.level_num);

-- guest 사용자에게 무료 구독 할당
INSERT INTO user_subscriptions (user_id, tier_id, subscription_start, subscription_end, is_active, payment_method, auto_renewal)
SELECT 'guest', t.tier_id, SYSTIMESTAMP, NULL, 1, 'free', 0
FROM subscription_tiers t
WHERE t.tier_name = 'free';

-- 기본 뱃지 데이터 (guest 사용자) - 갤럭시(기업용) 제외, API 테스트 관련 제외
INSERT INTO user_badges (user_id, badge_type, badge_name, badge_description, badge_icon, badge_color, badge_level, is_equipped) VALUES
('guest', 'achievement', '첫 대화', '처음으로 AI와 대화를 나눈 기념', '💬', '#4CAF50', 1, 1);

INSERT INTO user_badges (user_id, badge_type, badge_name, badge_description, badge_icon, badge_color, is_equipped) VALUES
('guest', 'special', '오비메이트 얼리어답터', '오비메이트 초기 사용자', '�', '#FF9800', 1);

-- 오비메이트 구독 등급 뱃지 (2025년 6월 업데이트)
-- 플래닛 등급 (월 1.5만원) - 다양한 기간과 특별 이벤트 뱃지
INSERT INTO user_badges (user_id, badge_type, badge_name, badge_description, badge_icon, badge_color, is_equipped) VALUES
('guest', 'premium', '플래닛 입문자', '첫 플래닛 구독을 시작한 기념', '🌱', '#4CAF50', 0);

INSERT INTO user_badges (user_id, badge_type, badge_name, badge_description, badge_icon, badge_color, is_equipped) VALUES
('guest', 'premium', '플래닛 정착민', '플래닛 3개월 연속 사용', '🏠', '#FF9800', 0);

INSERT INTO user_badges (user_id, badge_type, badge_name, badge_description, badge_icon, badge_color, is_equipped) VALUES
('guest', 'premium', '플래닛 거주자', '플래닛 6개월 연속 사용', '🏘️', '#FF5722', 0);

INSERT INTO user_badges (user_id, badge_type, badge_name, badge_description, badge_icon, badge_color, is_equipped) VALUES
('guest', 'premium', '플래닛 시민', '플래닛 1년 연속 사용', '🏛️', '#E91E63', 0);

INSERT INTO user_badges (user_id, badge_type, badge_name, badge_description, badge_icon, badge_color, is_equipped) VALUES
('guest', 'premium', '플래닛 베테랑', '플래닛 2년 이상 충성 고객', '👑', '#9C27B0', 0);

-- 스타 등급 (월 15만원) - 프리미엄 뱃지들
INSERT INTO user_badges (user_id, badge_type, badge_name, badge_description, badge_icon, badge_color, is_equipped) VALUES
('guest', 'premium', '스타 신예', '스타 등급 첫 구독 기념', '⭐', '#FFC107', 0);

INSERT INTO user_badges (user_id, badge_type, badge_name, badge_description, badge_icon, badge_color, is_equipped) VALUES
('guest', 'premium', '스타 라이더', '스타 3개월 연속 사용', '🌟', '#FF9800', 0);

INSERT INTO user_badges (user_id, badge_type, badge_name, badge_description, badge_icon, badge_color, is_equipped) VALUES
('guest', 'premium', '스타 마스터', '스타 6개월 연속 사용', '✨', '#FFD700', 0);

INSERT INTO user_badges (user_id, badge_type, badge_name, badge_description, badge_icon, badge_color, is_equipped) VALUES
('guest', 'premium', '스타 레전드', '스타 1년 연속 사용', '🌠', '#FFEB3B', 0);

INSERT INTO user_badges (user_id, badge_type, badge_name, badge_description, badge_icon, badge_color, is_equipped) VALUES
('guest', 'premium', '슈퍼스타', '스타 2년 이상 VIP 고객', '☀️', '#FFF176', 0);

INSERT INTO user_badges (user_id, badge_type, badge_name, badge_description, badge_icon, badge_color, is_equipped) VALUES
('guest', 'premium', '얼티밋 스타', '스타 3년 이상 최고 등급', '💫', '#FFCC02', 0);

-- 🏆 특별 이벤트 및 성취 뱃지
INSERT INTO user_badges (user_id, badge_type, badge_name, badge_description, badge_icon, badge_color, is_equipped) VALUES
('guest', 'achievement', '대화왕', '100회 이상 AI와 대화', '👑', '#FFD700', 0);

INSERT INTO user_badges (user_id, badge_type, badge_name, badge_description, badge_icon, badge_color, is_equipped) VALUES
('guest', 'achievement', '탐험가', '10가지 이상 다른 주제로 대화', '🧭', '#4CAF50', 0);

INSERT INTO user_badges (user_id, badge_type, badge_name, badge_description, badge_icon, badge_color, is_equipped) VALUES
('guest', 'achievement', '야행성', '밤 12시 이후에 활동한 기록', '🦉', '#673AB7', 0);

INSERT INTO user_badges (user_id, badge_type, badge_name, badge_description, badge_icon, badge_color, is_equipped) VALUES
('guest', 'achievement', '이른 새', '오전 6시 이전에 활동한 기록', '🐔', '#FF9800', 0);

INSERT INTO user_badges (user_id, badge_type, badge_name, badge_description, badge_icon, badge_color, is_equipped) VALUES
('guest', 'achievement', '파일 마스터', '50개 이상 파일을 업로드', '📎', '#2196F3', 0);

-- 🎉 특별 기념일 뱃지
INSERT INTO user_badges (user_id, badge_type, badge_name, badge_description, badge_icon, badge_color, is_equipped) VALUES
('guest', 'event', '창립 기념', 'Orbitmate 1주년 기념 뱃지', '🎂', '#E91E63', 0);

INSERT INTO user_badges (user_id, badge_type, badge_name, badge_description, badge_icon, badge_color, is_equipped) VALUES
('guest', 'event', '신년 맞이', '새해 첫 로그인 기념', '🎊', '#FF5722', 0);

INSERT INTO user_badges (user_id, badge_type, badge_name, badge_description, badge_icon, badge_color, is_equipped) VALUES
('guest', 'event', '여름 휴가', '여름 특별 이벤트 참여', '🏖️', '#00BCD4', 0);

-- 🌟 일반 사용자 성취 뱃지 추가
INSERT INTO user_badges (user_id, badge_type, badge_name, badge_description, badge_icon, badge_color, is_equipped) VALUES
('guest', 'achievement', '출석왕', '7일 연속 로그인', '📅', '#4CAF50', 0);

INSERT INTO user_badges (user_id, badge_type, badge_name, badge_description, badge_icon, badge_color, is_equipped) VALUES
('guest', 'achievement', '소셜 마스터', '친구 추천으로 가입', '👥', '#2196F3', 0);

INSERT INTO user_badges (user_id, badge_type, badge_name, badge_description, badge_icon, badge_color, is_equipped) VALUES
('guest', 'achievement', '창작자', '긴 대화를 통해 창의적 작업 완성', '✍️', '#9C27B0', 0);

-- 🚀 개발자 기여 뱃지 (기여 활동 장려용)
INSERT INTO user_badges (user_id, badge_type, badge_name, badge_description, badge_icon, badge_color, is_equipped) VALUES
('guest', 'special', '알파 테스터', '오비메이트 알파 버전 테스터', '🧪', '#2196F3', 0);

INSERT INTO user_badges (user_id, badge_type, badge_name, badge_description, badge_icon, badge_color, is_equipped) VALUES
('guest', 'special', '베타 테스터', '오비메이트 베타 버전 테스터', '🔬', '#FF9800', 0);

INSERT INTO user_badges (user_id, badge_type, badge_name, badge_description, badge_icon, badge_color, is_equipped) VALUES
('guest', 'special', '버그 헌터', '버그 신고로 서비스 개선에 기여', '🐛', '#795548', 0);

INSERT INTO user_badges (user_id, badge_type, badge_name, badge_description, badge_icon, badge_color, is_equipped) VALUES
('guest', 'special', '피드백 전문가', '유용한 피드백 제공', '💡', '#FFC107', 0);

-- 특정 사용자 정보 조회 쿼리 (A66C8382886C4EA6B57B9F1033E49EB2)
-- 이 쿼리는 사용자의 기본 정보, 설정, 프로필 정보를 모두 가져옵니다
SELECT u.*, 
  us.theme, us.language, us.font_size, us.notifications_enabled, us.ai_model_preference,
  up.theme_preference, up.bio, up.badge, up.experience, up."level",
  up.nickname, up.birth_date, up.gender, up.introduction, up.profile_theme, up.profile_border,
  up.profile_background, up.status_message, up.experience_multiplier, up.premium_until, up.is_premium
FROM users u
LEFT JOIN user_settings us ON u.user_id = us.user_id
LEFT JOIN user_profiles up ON u.user_id = up.user_id
WHERE u.user_id = 'A66C8382886C4EA6B57B9F1033E49EB2';

COMMIT;
