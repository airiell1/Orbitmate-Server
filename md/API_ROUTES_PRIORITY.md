# Orbitmate API 라우트 우선순위 정리

## 🔥 최우선 핵심 API (반드시 필요)

### 1. 사용자 인증 & 기본 정보
```
POST   /api/users/register                    # 회원가입
POST   /api/users/login                       # 로그인  
POST   /api/users/check-email                 # 이메일 중복 체크
GET    /api/users/:user_id/profile            # 프로필 조회
PUT    /api/users/:user_id/profile            # 프로필 업데이트
DELETE /api/users/:user_id                    # 회원 탈퇴
```

### 2. 사용자 설정
```
GET    /api/users/:user_id/settings           # 설정 조회
PUT    /api/users/:user_id/settings           # 설정 업데이트
```

### 3. 채팅 기능 (별도 파일)
```
POST   /api/chat/sessions                     # 세션 생성
GET    /api/chat/sessions                     # 세션 목록
POST   /api/chat/sessions/:id/messages        # 메시지 전송
GET    /api/chat/sessions/:id/messages        # 메시지 조회
```

---

## ⭐ 중요 기능 API (사용자 경험 향상)

### 4. 레벨 & 경험치 시스템
```
GET    /api/users/:user_id/level              # 레벨 정보 조회
POST   /api/users/:user_id/experience         # 경험치 추가 (관리자용)
```

### 5. 기본 뱃지 시스템
```
GET    /api/users/:user_id/badges             # 뱃지 목록 조회
PUT    /api/users/:user_id/badges/:badge_id   # 뱃지 착용/해제
```

---

## 🎨 부가 기능 API (나중에 구현)

### 6. 프로필 꾸미기
```
GET    /api/users/:user_id/customization      # 꾸미기 설정 조회
PUT    /api/users/:user_id/customization      # 꾸미기 설정 업데이트
POST   /api/users/:user_id/profile/image      # 프로필 이미지 업로드
```

### 7. 다국어 지원
```
GET    /api/users/translations/:lang          # 번역 리소스 조회
PUT    /api/users/:user_id/language           # 언어 설정 업데이트
```

---

## 🧪 개발/테스트 API (개발 완료 후 구현)

### 8. 사용자 활동 & 고급 뱃지
```
POST   /api/users/:user_id/bug-report         # 버그 제보
POST   /api/users/:user_id/feedback           # 피드백 제출
POST   /api/users/:user_id/test-participation # 테스트 참여
POST   /api/users/:user_id/subscription-badge # 구독 뱃지 업그레이드
POST   /api/users/:user_id/approve-badge      # 뱃지 승인 (관리자)
POST   /api/users/:user_id/badges/upgrade     # 뱃지 레벨 업그레이드
GET    /api/users/:user_id/badge-details      # 뱃지 상세 조회
```

---

## 📋 구현 우선순위 제안

### Phase 1: 핵심 기능 (즉시 구현)
1. **사용자 인증 & 기본 정보** - 필수
2. **사용자 설정** - 필수  
3. **채팅 기능** - 핵심 서비스

### Phase 2: 사용자 경험 (2차 구현)
4. **레벨 & 경험치** - 게임화 요소
5. **기본 뱃지** - 성취감 제공

### Phase 3: 개인화 (3차 구현)  
6. **프로필 꾸미기** - UI/UX 향상
7. **다국어 지원** - 글로벌 대응

### Phase 4: 고급 기능 (마지막 구현)
8. **사용자 활동 & 고급 뱃지** - 커뮤니티 기능

---

## 🚀 즉시 적용 권장사항

### 현재 라우트 파일 분리 제안:
```
routes/
├── users.js          # Phase 1-2 API만 포함 (핵심 기능)
├── userActivity.js   # Phase 4 API 분리 (뱃지, 활동 관련)  
├── chat.js           # 채팅 관련 (이미 분리됨)
└── admin.js          # 관리자 전용 API
```

### 단계별 구현:
1. **지금**: `users.js`에서 Phase 1-2만 남기고 나머지 주석 처리
2. **나중**: Phase 3-4는 별도 파일로 분리
3. **최종**: 모든 기능 활성화

이렇게 하면 핵심 기능부터 안정적으로 구축할 수 있습니다!
