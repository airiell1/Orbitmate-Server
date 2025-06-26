# 🏗️ 전체 컨트롤러 리팩토링 마스터플랜

## 📊 현재 컨트롤러 상태 분석

### ✅ 완료됨
- **`userController.js`** - ServiceFactory 패턴 적용 완료

### 🔄 리팩토링 필요
1. **`chatController.js`** - 복잡한 스트리밍 로직 (고난이도)
2. **`sessionController.js`** - 표준 CRUD 패턴 (쉬움)
3. **`subscriptionController.js`** - 비즈니스 로직 포함 (중간)
4. **`searchController.js`** - 외부 API 연동 (중간)
5. **`userActivityController.js`** - 뱃지/활동 관리 (중간)
6. **`translationController.js`** - 번역 리소스 (쉬움)
7. **`aiInfoController.js`** - AI 모델 정보 (쉬움)

### 🗑️ 정리 대상 (중복)
- **`authController.js`** → `userController.js`로 통합됨
- **`userProfileController.js`** → `userController.js`로 통합됨  
- **`userSettingsController.js`** → `userController.js`로 통합됨

---

## 🎯 리팩토링 우선순위 및 전략

### Phase 1: 간단한 CRUD (즉시 가능)
**예상 시간: 1-2시간**

1. **`sessionController.js`**
   - 표준 CRUD 패턴
   - `createSessionService`, `createUserService` 활용
   
2. **`translationController.js`**
   - 읽기 전용 API 위주
   - `createReadService` 활용

3. **`aiInfoController.js`**
   - 간단한 정보 조회
   - `createReadService` 활용

### Phase 2: 비즈니스 로직 (중간 난이도)
**예상 시간: 2-3시간**

4. **`subscriptionController.js`**
   - 구독 관리 로직
   - `createSubscriptionService` 활용
   
5. **`userActivityController.js`**
   - 뱃지/활동 시스템
   - `createBadgeService`, `createExperienceService` 활용

6. **`searchController.js`**
   - 외부 API 연동
   - 새로운 `createExternalApiService` 패턴 필요

### Phase 3: 복잡한 로직 (고난이도)
**예상 시간: 3-4시간**

7. **`chatController.js`**
   - 스트리밍 SSE 처리
   - 파일 업로드 로직
   - 특별한 `createStreamService`, `createFileUploadService` 패턴 필요

---

## 🛠️ 새로운 ServiceFactory 패턴 필요

### 1. 스트리밍 서비스
```javascript
function createStreamService(modelFunction, options = {}) {
  return createService(modelFunction, {
    useTransaction: true,
    preprocessor: (sessionId, userId, messageData, clientIp, streamCallback) => {
      // 스트리밍 유효성 검사
      if (!streamCallback) throw new Error("Stream callback required");
      return [sessionId, userId, messageData, clientIp, streamCallback];
    },
    postprocessor: (result, ...args) => {
      // 스트리밍 완료 후 처리
      return result;
    },
    ...options
  });
}
```

### 2. 파일 업로드 서비스
```javascript
function createFileUploadService(modelFunction, options = {}) {
  return createService(modelFunction, {
    useTransaction: true,
    preprocessor: (sessionId, userId, file, messageContent) => {
      // 파일 유효성 검사
      const allowedTypes = ["image/jpeg", "image/png", "application/pdf"];
      const maxSize = 5 * 1024 * 1024; // 5MB
      
      if (!allowedTypes.includes(file.mimetype)) {
        throw new Error(`Invalid file type. Allowed: ${allowedTypes.join(", ")}`);
      }
      if (file.size > maxSize) {
        throw new Error(`File too large. Max: ${maxSize / (1024 * 1024)}MB`);
      }
      
      return [sessionId, userId, file, messageContent];
    },
    errorHandler: async (error, sessionId, userId, file) => {
      // 에러 시 파일 삭제
      if (file && file.path) {
        try { fs.unlinkSync(file.path); } catch(e) {}
      }
      throw error;
    },
    ...options
  });
}
```

### 3. 외부 API 서비스
```javascript
function createExternalApiService(modelFunction, options = {}) {
  return createService(modelFunction, {
    useTransaction: false, // 외부 API는 트랜잭션 불필요
    preprocessor: async (...args) => {
      // API 키 확인, 요청 제한 체크 등
      return args;
    },
    postprocessor: (result) => {
      // 외부 API 응답 형식 변환
      return result;
    },
    errorHandler: async (error) => {
      // 외부 API 에러 처리
      if (error.response) {
        throw new Error(`External API Error: ${error.response.status}`);
      }
      throw error;
    },
    ...options
  });
}
```

### 4. 구독 관리 서비스
```javascript
function createSubscriptionService(modelFunction, options = {}) {
  return createUserService(modelFunction, {
    postprocessor: (result, userId) => {
      return {
        user_id: userId,
        subscription_info: result,
        checked_at: new Date().toISOString()
      };
    },
    ...options
  });
}
```

---

## 📋 단계별 실행 계획

### 1단계: ServiceFactory 확장 (30분)
- `utils/serviceFactory.js`에 새로운 패턴들 추가
- 스트리밍, 파일업로드, 외부API, 구독 서비스 패턴 구현

### 2단계: 간단한 컨트롤러 리팩토링 (1-2시간)
- `sessionController.js`
- `translationController.js`  
- `aiInfoController.js`

### 3단계: 중간 난이도 컨트롤러 (2-3시간)
- `subscriptionController.js`
- `userActivityController.js`
- `searchController.js`

### 4단계: 복잡한 컨트롤러 (3-4시간)
- `chatController.js` (스트리밍 + 파일업로드)

### 5단계: 정리 및 최적화 (1시간)
- 중복 파일 제거
- 라우트 연결 확인
- 문서 업데이트

---

## 🎯 예상 효과

### 개발 생산성
- **코드 중복**: 80% 감소
- **새 기능 개발**: 50% 빨라짐
- **버그 수정**: 70% 쉬워짐

### 코드 품질
- **일관성**: 표준화된 패턴
- **유지보수**: 중앙화된 로직
- **테스트**: 표준화된 구조

### 성능
- **메모리**: 중복 제거로 효율성 증가
- **응답속도**: 최적화된 트랜잭션 관리
- **확장성**: 모듈화된 구조

---

## 🚀 시작할 준비가 되었나요?

어떤 컨트롤러부터 시작하시겠어요?

1. **쉬운 것부터**: `sessionController.js` (표준 CRUD)
2. **중요한 것부터**: `subscriptionController.js` (비즈니스 로직)
3. **복잡한 것부터**: `chatController.js` (스트리밍)
4. **ServiceFactory 먼저 확장**: 새로운 패턴들 추가

추천은 **1번 (쉬운 것부터)**입니다! 💪
