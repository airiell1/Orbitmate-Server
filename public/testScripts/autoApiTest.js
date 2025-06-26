// autoApiTest.js - 자동화된 전체 API 테스트
// AI 응답 호출이 필요한 부분을 제외한 모든 API 엔드포인트 테스트

class ApiAutoTester {
    constructor() {
        this.results = {
            total: 0,
            passed: 0,
            failed: 0,
            tests: []
        };
        this.testUser = {
            username: 'APItestUser',
            email: 'API@example.com',
            password: 'password123',
            user_id: 'API_TEST_USER_ID' // 고정된 테스트 사용자 ID
        };
        this.testSession = {
            session_id: 'API_TEST_SESSION_ID', // 고정된 테스트 세션 ID
            message_id: 'API_TEST_USER_MESSAGE_ID' // 고정된 테스트 메시지 ID
        };
    }

    // 테스트 결과 로그
    log(testName, status, response = null, error = null) {
        const result = {
            name: testName,
            status,
            timestamp: new Date().toISOString(),
            response: response ? JSON.stringify(response, null, 2) : null,
            error: error ? error.message : null
        };
        
        this.results.tests.push(result);
        this.results.total++;
        
        if (status === 'PASS') {
            this.results.passed++;
            console.log(`✅ ${testName} - PASS`);
        } else {
            this.results.failed++;
            console.log(`❌ ${testName} - FAIL`, error || response);
        }
    }

    // API 호출 헬퍼
    async apiCall(url, options = {}) {
        try {
            const response = await fetch(url, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });
            
            let data;
            try {
                data = await response.json();
            } catch {
                data = { status: response.status, statusText: response.statusText };
            }
            
            return { response, data, status: response.status };
        } catch (error) {
            throw new Error(`네트워크 오류: ${error.message}`);
        }
    }

    // =========================
    // 1. 사용자 관리 API 테스트
    // =========================

    async testUserRegistration() {
        try {
            const { data, status } = await this.apiCall('/api/users/register', {
                method: 'POST',
                body: JSON.stringify({
                    username: this.testUser.username,
                    email: this.testUser.email,
                    password: this.testUser.password
                })
            });

            // 성공: 신규 등록 또는 이미 등록된 경우 모두 성공으로 처리
            if (status === 201 || status === 200) {
                if (data.status === 'success' && data.data && data.data.user_id === this.testUser.user_id) {
                    // 등록 성공 시 user_id 확실히 저장
                    this.testUser.user_id = data.data.user_id;
                    this.log('사용자 등록', 'PASS', data);
                } else if (data.status === 'error' && data.error && data.error.message && data.error.message.includes('이미 존재')) {
                    this.log('사용자 등록', 'PASS', data); // 이미 등록된 경우도 성공으로 처리
                } else {
                    this.log('사용자 등록', 'FAIL', data);
                }
            } else {
                this.log('사용자 등록', 'FAIL', data);
            }
        } catch (error) {
            this.log('사용자 등록', 'FAIL', null, error);
        }
    }

    async testUserLogin() {
        try {
            const { data, status } = await this.apiCall('/api/users/login', {
                method: 'POST',
                body: JSON.stringify({
                    email: this.testUser.email,
                    password: this.testUser.password
                })
            });

            if (status === 200) {
                if (data.status === 'success' && data.data && data.data.token) {
                    // 로그인 성공 시 user_id 저장 (이미 testUser에 설정되어 있지만 확실히 하기 위해)
                    if (data.data.user_id) {
                        this.testUser.user_id = data.data.user_id;
                    }
                    this.log('사용자 로그인', 'PASS', data);
                } else {
                    this.log('사용자 로그인', 'FAIL', data);
                }
            } else {
                this.log('사용자 로그인', 'FAIL', data);
            }
        } catch (error) {
            this.log('사용자 로그인', 'FAIL', null, error);
        }
    }

    async testEmailCheck() {
        try {
            const { data, status } = await this.apiCall('/api/users/check-email', {
                method: 'POST',
                body: JSON.stringify({
                    email: this.testUser.email
                })
            });

            if (status === 200) {
                if (data.status === 'success' && typeof data.data.email_exists === 'boolean') {
                    this.log('이메일 중복 확인', 'PASS', data);
                } else {
                    this.log('이메일 중복 확인', 'FAIL', data);
                }
            } else {
                this.log('이메일 중복 확인', 'FAIL', data);
            }
        } catch (error) {
            this.log('이메일 중복 확인', 'FAIL', null, error);
        }
    }

    async testUserProfile() {
        if (!this.testUser.user_id) {
            this.log('사용자 프로필 조회', 'SKIP', { reason: 'user_id가 없음' });
            return;
        }

        try {
            const { data, status } = await this.apiCall(`/api/users/${this.testUser.user_id}/profile`);

            if (status === 200) {
                if (data.status === 'success' && data.data && data.data.user_id) {
                    this.log('사용자 프로필 조회', 'PASS', data);
                } else {
                    this.log('사용자 프로필 조회', 'FAIL', data);
                }
            } else {
                this.log('사용자 프로필 조회', 'FAIL', data);
            }
        } catch (error) {
            this.log('사용자 프로필 조회', 'FAIL', null, error);
        }
    }

    async testUserProfileUpdate() {
        if (!this.testUser.user_id) {
            this.log('사용자 프로필 수정', 'SKIP', { reason: 'user_id가 없음' });
            return;
        }

        try {
            const { data, status } = await this.apiCall(`/api/users/${this.testUser.user_id}/profile`, {
                method: 'PUT',
                body: JSON.stringify({
                    bio: '자동 테스트로 생성된 프로필입니다.',
                    nickname: '테스트닉네임'
                })
            });

            if (status === 200) {
                if (data.status === 'success') {
                    this.log('사용자 프로필 수정', 'PASS', data);
                } else {
                    this.log('사용자 프로필 수정', 'FAIL', data);
                }
            } else {
                this.log('사용자 프로필 수정', 'FAIL', data);
            }
        } catch (error) {
            this.log('사용자 프로필 수정', 'FAIL', null, error);
        }
    }

    // =========================
    // 2. 세션 관리 API 테스트
    // =========================

    async testSessionCreation() {
        if (!this.testUser.user_id) {
            this.log('세션 생성', 'SKIP', { reason: 'user_id가 없음' });
            return;
        }

        try {
            const { data, status } = await this.apiCall('/api/chat/sessions', {
                method: 'POST',
                body: JSON.stringify({
                    user_id: this.testUser.user_id,
                    title: '자동 테스트 세션',
                    category: 'test'
                })
            });

            if (status === 201) {
                if (data.status === 'success' && data.data && data.data.session_id) {
                    // 실제 생성된 session_id로 업데이트
                    this.testSession.session_id = data.data.session_id;
                    this.log('세션 생성', 'PASS', data);
                } else {
                    this.log('세션 생성', 'FAIL', data);
                }
            } else {
                this.log('세션 생성', 'FAIL', data);
            }
        } catch (error) {
            this.log('세션 생성', 'FAIL', null, error);
        }
    }

    async testSessionList() {
        if (!this.testUser.user_id) {
            this.log('세션 목록 조회', 'SKIP', { reason: 'user_id가 없음' });
            return;
        }

        try {
            const { data, status } = await this.apiCall(`/api/sessions/${this.testUser.user_id}/chat/sessions`);

            if (status === 200) {
                if (data.status === 'success' && Array.isArray(data.data)) {
                    this.log('세션 목록 조회', 'PASS', data);
                } else {
                    this.log('세션 목록 조회', 'FAIL', data);
                }
            } else {
                this.log('세션 목록 조회', 'FAIL', data);
            }
        } catch (error) {
            this.log('세션 목록 조회', 'FAIL', null, error);
        }
    }

    async testSessionUpdate() {
        if (!this.testSession.session_id) {
            this.log('세션 수정', 'SKIP', { reason: 'session_id가 없음' });
            return;
        }

        try {
            const { data, status } = await this.apiCall(`/api/chat/sessions/${this.testSession.session_id}`, {
                method: 'PUT',
                body: JSON.stringify({
                    title: '수정된 테스트 세션',
                    category: 'updated_test',
                    is_archived: false
                })
            });

            if (status === 200) {
                if (data.status === 'success') {
                    this.log('세션 수정', 'PASS', data);
                } else {
                    this.log('세션 수정', 'FAIL', data);
                }
            } else {
                this.log('세션 수정', 'FAIL', data);
            }
        } catch (error) {
            this.log('세션 수정', 'FAIL', null, error);
        }
    }

    async testSessionMessages() {
        if (!this.testSession.session_id) {
            this.log('세션 메시지 조회', 'SKIP', { reason: 'session_id가 없음' });
            return;
        }

        try {
            const { data, status } = await this.apiCall(`/api/chat/sessions/${this.testSession.session_id}/messages`);

            if (status === 200) {
                if (data.status === 'success' && Array.isArray(data.data)) {
                    this.log('세션 메시지 조회', 'PASS', data);
                } else {
                    this.log('세션 메시지 조회', 'FAIL', data);
                }
            } else {
                this.log('세션 메시지 조회', 'FAIL', data);
            }
        } catch (error) {
            this.log('세션 메시지 조회', 'FAIL', null, error);
        }
    }

    // =========================
    // 3. 구독 관리 API 테스트
    // =========================

    async testSubscriptionInfo() {
        if (!this.testUser.user_id) {
            this.log('구독 정보 조회', 'SKIP', { reason: 'user_id가 없음' });
            return;
        }

        try {
            const { data, status } = await this.apiCall(`/api/subscriptions/users/${this.testUser.user_id}/subscription`);

            if (status === 200) {
                if (data.status === 'success' && data.data) {
                    this.log('구독 정보 조회', 'PASS', data);
                } else {
                    this.log('구독 정보 조회', 'FAIL', data);
                }
            } else {
                this.log('구독 정보 조회', 'FAIL', data);
            }
        } catch (error) {
            this.log('구독 정보 조회', 'FAIL', null, error);
        }
    }

    async testSubscriptionTiers() {
        try {
            const { data, status } = await this.apiCall('/api/subscriptions/tiers');

            if (status === 200) {
                if (data.status === 'success' && Array.isArray(data.data)) {
                    this.log('구독 등급 목록 조회', 'PASS', data);
                } else {
                    this.log('구독 등급 목록 조회', 'FAIL', data);
                }
            } else {
                this.log('구독 등급 목록 조회', 'FAIL', data);
            }
        } catch (error) {
            this.log('구독 등급 목록 조회', 'FAIL', null, error);
        }
    }

    // =========================
    // 4. 번역 API 테스트 (사용하지 않음 - 스킵)
    // =========================

    async testTranslations() {
        this.log('번역 리소스 조회', 'SKIP', { reason: '번역 API 사용하지 않음' });
    }

    // =========================
    // 5. AI 정보 API 테스트
    // =========================

    async testAiModels() {
        try {
            const { data, status } = await this.apiCall('/api/ai/models');

            if (status === 200) {
                if (data.status === 'success' && data.data) {
                    this.log('AI 모델 목록 조회', 'PASS', data);
                } else {
                    this.log('AI 모델 목록 조회', 'FAIL', data);
                }
            } else {
                this.log('AI 모델 목록 조회', 'FAIL', data);
            }
        } catch (error) {
            this.log('AI 모델 목록 조회', 'FAIL', null, error);
        }
    }

    async testAiProviders() {
        // AI 제공자 API가 구현되지 않음 - 스킵
        this.log('AI 제공자 목록 조회', 'SKIP', { reason: 'API 미구현' });
        return;
        
        try {
            const { data, status } = await this.apiCall('/api/ai/providers');

            if (status === 200) {
                this.log('AI 제공자 목록 조회', 'PASS', data);
            } else {
                this.log('AI 제공자 목록 조회', 'FAIL', data);
            }
        } catch (error) {
            this.log('AI 제공자 목록 조회', 'FAIL', null, error);
        }
    }

    // =========================
    // 6. 검색 API 테스트
    // =========================

    async testWikipediaSearch() {
        try {
            const { data, status } = await this.apiCall('/api/search/wikipedia?query=테스트&limit=3&language=ko');

            if (status === 200) {
                if (data.status === 'success' && data.data) {
                    this.log('Wikipedia 검색', 'PASS', data);
                } else {
                    this.log('Wikipedia 검색', 'FAIL', data);
                }
            } else {
                this.log('Wikipedia 검색', 'FAIL', data);
            }
        } catch (error) {
            this.log('Wikipedia 검색', 'FAIL', null, error);
        }
    }

    async testWeatherSearch() {
        try {
            const { data, status } = await this.apiCall('/api/search/weather?ip=127.0.0.1');

            if (status === 200) {
                if (data.status === 'success' && data.data) {
                    this.log('날씨 정보 조회', 'PASS', data);
                } else {
                    this.log('날씨 정보 조회', 'FAIL', data);
                }
            } else {
                this.log('날씨 정보 조회', 'FAIL', data);
            }
        } catch (error) {
            this.log('날씨 정보 조회', 'FAIL', null, error);
        }
    }

    // =========================
    // 7. 사용자 활동 API 테스트
    // =========================

    async testUserLevel() {
        if (!this.testUser.user_id) {
            this.log('사용자 레벨 조회', 'SKIP', { reason: 'user_id가 없음' });
            return;
        }

        try {
            const { data, status } = await this.apiCall(`/api/users/${this.testUser.user_id}/level`);

            if (status === 200) {
                if (data.status === 'success' && data.data) {
                    this.log('사용자 레벨 조회', 'PASS', data);
                } else {
                    this.log('사용자 레벨 조회', 'FAIL', data);
                }
            } else {
                this.log('사용자 레벨 조회', 'FAIL', data);
            }
        } catch (error) {
            this.log('사용자 레벨 조회', 'FAIL', null, error);
        }
    }

    async testUserBadges() {
        if (!this.testUser.user_id) {
            this.log('사용자 뱃지 조회', 'SKIP', { reason: 'user_id가 없음' });
            return;
        }

        try {
            const { data, status } = await this.apiCall(`/api/users/${this.testUser.user_id}/badges`);

            if (status === 200) {
                if (data.status === 'success' && data.data) {
                    this.log('사용자 뱃지 조회', 'PASS', data);
                } else {
                    this.log('사용자 뱃지 조회', 'FAIL', data);
                }
            } else {
                this.log('사용자 뱃지 조회', 'FAIL', data);
            }
        } catch (error) {
            this.log('사용자 뱃지 조회', 'FAIL', null, error);
        }
    }

    // =========================
    // 8. 정리 작업
    // =========================

    async testCleanup() {
        // 세션 삭제
        if (this.testSession.session_id) {
            try {
                await this.apiCall(`/api/chat/sessions/${this.testSession.session_id}`, {
                    method: 'DELETE',
                    body: JSON.stringify({ user_id: this.testUser.user_id })
                });
                this.log('테스트 세션 정리', 'PASS');
            } catch (error) {
                this.log('테스트 세션 정리', 'FAIL', null, error);
            }
        }

        // 사용자 삭제 (운영환경에서는 주의)
        if (this.testUser.user_id) {
            try {
                await this.apiCall(`/api/users/${this.testUser.user_id}`, {
                    method: 'DELETE'
                });
                this.log('테스트 사용자 정리', 'PASS');
            } catch (error) {
                this.log('테스트 사용자 정리', 'FAIL', null, error);
            }
        }
    }

    // =========================
    // 전체 테스트 실행
    // =========================

    async runAllTests() {
        console.log('🚀 API 자동 테스트 시작...');
        console.log('================================');

        // 1. 사용자 관리 테스트
        await this.testUserRegistration();
        await this.sleep(500);
        await this.testUserLogin();
        await this.sleep(500);
        await this.testEmailCheck();
        await this.sleep(500);
        await this.testUserProfile();
        await this.sleep(500);
        await this.testUserProfileUpdate();
        await this.sleep(500);

        // 2. 세션 관리 테스트
        await this.testSessionCreation();
        await this.sleep(500);
        await this.testSessionList();
        await this.sleep(500);
        await this.testSessionUpdate();
        await this.sleep(500);
        await this.testSessionMessages();
        await this.sleep(500);

        // 3. 구독 관리 테스트
        await this.testSubscriptionInfo();
        await this.sleep(500);
        await this.testSubscriptionTiers();
        await this.sleep(500);

        // 4. 번역 테스트
        await this.testTranslations();
        await this.sleep(500);

        // 5. AI 정보 테스트
        await this.testAiModels();
        await this.sleep(500);
        await this.testAiProviders();
        await this.sleep(500);

        // 6. 검색 테스트
        await this.testWikipediaSearch();
        await this.sleep(500);
        await this.testWeatherSearch();
        await this.sleep(500);

        // 7. 사용자 활동 테스트
        await this.testUserLevel();
        await this.sleep(500);
        await this.testUserBadges();
        await this.sleep(500);

        // 8. 정리 작업
        await this.testCleanup();

        this.showResults();
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    showResults() {
        console.log('\n================================');
        console.log('📊 테스트 결과 요약');
        console.log('================================');
        console.log(`전체 테스트: ${this.results.total}`);
        console.log(`✅ 성공: ${this.results.passed}`);
        console.log(`❌ 실패: ${this.results.failed}`);
        console.log(`📈 성공률: ${((this.results.passed / this.results.total) * 100).toFixed(1)}%`);
        
        if (this.results.failed > 0) {
            console.log('\n❌ 실패한 테스트:');
            this.results.tests
                .filter(test => test.status === 'FAIL')
                .forEach(test => {
                    console.log(`  - ${test.name}: ${test.error || 'Unknown error'}`);
                });
        }

        // DOM에 결과 표시
        this.displayResultsInDOM();
    }

    displayResultsInDOM() {
        const resultsContainer = document.getElementById('api-test-results');
        
        if (!resultsContainer) {
            console.error('결과 표시 컨테이너를 찾을 수 없습니다.');
            return;
        }

        // 결과 컨테이너 표시 및 내용 업데이트
        resultsContainer.style.display = 'block';
        
        resultsContainer.innerHTML = `
            <div class="test-summary" style="margin-bottom: 20px; padding: 15px; background: white; border-radius: 6px; border: 1px solid #dee2e6;">
                <h4 style="margin: 0 0 10px 0; color: #28a745;">📊 테스트 결과 요약</h4>
                <p style="margin: 5px 0;"><strong>전체:</strong> ${this.results.total} | 
                   <strong style="color: green;">성공:</strong> ${this.results.passed} | 
                   <strong style="color: red;">실패:</strong> ${this.results.failed} | 
                   <strong>성공률:</strong> ${((this.results.passed / this.results.total) * 100).toFixed(1)}%</p>
                <p style="margin: 5px 0; color: #666; font-size: 0.9em;">테스트 완료 시간: ${new Date().toLocaleString()}</p>
            </div>
            <div class="test-details">
                ${this.results.tests.map(test => `
                    <div class="test-item ${test.status.toLowerCase()}" style="padding: 10px; margin: 5px 0; border-left: 4px solid ${test.status === 'PASS' ? '#28a745' : '#dc3545'}; background: white; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span>
                                <span style="color: ${test.status === 'PASS' ? '#28a745' : '#dc3545'}; font-weight: bold;">${test.status === 'PASS' ? '✅' : '❌'}</span>
                                <strong style="margin-left: 8px;">${test.name}</strong>
                            </span>
                            <small style="color: #666;">${new Date(test.timestamp).toLocaleTimeString()}</small>
                        </div>
                        ${test.error ? `<div style="color: #dc3545; font-size: 0.9em; margin-top: 5px; padding: 5px; background: #f8d7da; border-radius: 3px;">오류: ${test.error}</div>` : ''}
                        ${test.response && test.status === 'PASS' ? `<div style="color: #155724; font-size: 0.8em; margin-top: 5px; padding: 5px; background: #d4edda; border-radius: 3px; max-height: 100px; overflow-y: auto;">응답: ${test.response.substring(0, 200)}${test.response.length > 200 ? '...' : ''}</div>` : ''}
                    </div>
                `).join('')}
            </div>
        `;
    }

    // 결과 내보내기
    exportResults() {
        const resultData = {
            summary: {
                total: this.results.total,
                passed: this.results.passed,
                failed: this.results.failed,
                successRate: ((this.results.passed / this.results.total) * 100).toFixed(1) + '%',
                timestamp: new Date().toISOString()
            },
            tests: this.results.tests
        };

        const dataStr = JSON.stringify(resultData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `api-test-results-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        console.log('📄 테스트 결과가 JSON 파일로 내보내졌습니다.');
    }

    // 결과 지우기
    clearResults() {
        this.results = {
            total: 0,
            passed: 0,
            failed: 0,
            tests: []
        };
        
        const resultsContainer = document.getElementById('api-test-results');
        if (resultsContainer) {
            resultsContainer.innerHTML = '<p style="color: #666; font-style: italic;">테스트 결과가 여기에 표시됩니다...</p>';
        }
        
        console.log('🗑️ 테스트 결과가 지워졌습니다.');
        alert('테스트 결과가 지워졌습니다.');
    }

    createResultsContainer() {
        const container = document.createElement('div');
        container.id = 'api-test-results';
        container.style.cssText = `
            margin: 20px 0;
            padding: 20px;
            border: 1px solid #ddd;
            border-radius: 8px;
            background: #f9f9f9;
        `;
        
        const style = document.createElement('style');
        style.textContent = `
            #api-test-results .test-item {
                padding: 8px;
                margin: 4px 0;
                border-left: 3px solid #ddd;
                background: white;
            }
            #api-test-results .test-item.pass {
                border-left-color: #4CAF50;
            }
            #api-test-results .test-item.fail {
                border-left-color: #f44336;
            }
            #api-test-results .success { color: #4CAF50; }
            #api-test-results .error { 
                color: #f44336; 
                font-size: 0.9em;
                margin-top: 4px;
            }
        `;
        document.head.appendChild(style);
        document.body.appendChild(container);
        
        return container;
    }
}

// 글로벌 함수로 등록
window.runAutoApiTest = async function() {
    const tester = new ApiAutoTester();
    await tester.runAllTests();
};

// 자동 실행 (페이지 로드 시)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        // DOM에 버튼 추가
        const button = document.createElement('button');
        button.textContent = '🚀 전체 API 테스트 실행';
        button.style.cssText = `
            padding: 12px 24px;
            font-size: 16px;
            background: #4CAF50;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            margin: 20px 0;
        `;
        button.onclick = window.runAutoApiTest;
        
        document.body.insertBefore(button, document.body.firstChild);
    });
}

// ES6 모듈 export
export default ApiAutoTester;
export { ApiAutoTester };

// 전역 함수들 (testScript.js에서 동적 import로 사용)
let globalTester = null;

export async function runAutoApiTest() {
    if (!globalTester) {
        globalTester = new ApiAutoTester();
    }
    await globalTester.runAllTests();
}

export function exportTestResults() {
    if (globalTester) {
        globalTester.exportResults();
    } else {
        alert('아직 실행된 테스트가 없습니다.');
    }
}

export function clearTestResults() {
    if (globalTester) {
        globalTester.clearResults();
    } else {
        alert('지울 테스트 결과가 없습니다.');
    }
}
