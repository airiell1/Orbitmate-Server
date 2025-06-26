# 🚀 Orbitmate API 라우트 현재 상태

## ✅ 현재 활성화된 API (Phase 1-3)

### 👤 사용자 인증 & 기본 정보
- `POST /api/users/register` - 회원가입
- `POST /api/users/login` - 로그인
- `POST /api/users/check-email` - 이메일 중복 체크
- `GET /api/users/:user_id/profile` - 프로필 조회
- `PUT /api/users/:user_id/profile` - 프로필 업데이트
- `DELETE /api/users/:user_id` - 회원 탈퇴
- `GET /api/users/:user_id/settings` - 설정 조회
- `PUT /api/users/:user_id/settings` - 설정 업데이트
- `POST /api/users/:user_id/profile/image` - 프로필 이미지 업로드

### 🎮 레벨 & 뱃지 시스템
- `GET /api/users/:user_id/level` - 레벨 정보 조회
- `POST /api/users/:user_id/experience` - 경험치 추가
- `GET /api/users/:user_id/badges` - 뱃지 목록 조회
- `PUT /api/users/:user_id/badges/:badge_id` - 뱃지 착용/해제

### 🎨 프로필 꾸미기 & 다국어
- `GET /api/users/:user_id/customization` - 꾸미기 설정 조회
- `PUT /api/users/:user_id/customization` - 꾸미기 설정 업데이트
- `GET /api/users/translations/:lang` - 번역 리소스 조회
- `PUT /api/users/:user_id/language` - 언어 설정 업데이트

## 💤 현재 비활성화된 API (Phase 4)

고급 뱃지 시스템 관련 API들이 주석 처리되어 있습니다:
- 버그 제보 API
- 피드백 제출 API  
- 테스트 참여 API
- 구독 뱃지 업그레이드 API
- 뱃지 승인 API (관리자용)
- 뱃지 레벨 업그레이드 API

## 🔧 활성화 방법

Phase 4 API를 사용하려면:

1. `routes/users.js`에서 주석(`/* */`) 제거
2. 컨트롤러 import 부분의 주석 제거
3. 해당 컨트롤러들이 구현되어 있는지 확인

## 📊 현재 상태 요약

- ✅ **활성화됨**: 핵심 기능 (18개 API)
- 💤 **비활성화됨**: 고급 기능 (7개 API)
- 🎯 **권장사항**: 핵심 기능부터 안정화 후 고급 기능 단계적 활성화

이렇게 정리하면 개발 우선순위가 명확해지고 코드 관리가 훨씬 쉬워집니다!
