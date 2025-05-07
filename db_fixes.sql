-- user_profiles 테이블의 "theme" 컬럼 이름 변경 
-- Oracle에서 예약어로 인식되는 문제 해결
ALTER TABLE user_profiles RENAME COLUMN theme TO theme_preference;

-- 필요한 경우 user.js에서 컬럼명 변경
-- 더 필요한 경우 user_profiles 테이블에 missing updated_at 컬럼 추가
ALTER TABLE user_profiles ADD updated_at TIMESTAMP DEFAULT SYSTIMESTAMP;

-- 가능한 경우 chat_messages 테이블에도 updated_at 컬럼 추가 (편집 메시지용)
-- 이미 edited_at이 있다면 필요 없음
-- ALTER TABLE chat_messages ADD updated_at TIMESTAMP;

COMMIT;
