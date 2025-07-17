/**
 * 관리자 권한 관리 테스트 스크립트
 * @description 관리자 권한 확인, 설정, 사용자 목록 조회 등 관리자 기능 테스트
 */

import { displayApiResponse, displayError } from './utils.js';

const BASE_URL = 'http://localhost:3000';

/**
 * 관리자 권한 확인 테스트
 */
export async function testCheckAdminStatus() {
  try {
    const userId = document.getElementById('admin-check-user-id').value;
    
    if (!userId) {
      displayError('사용자 ID를 입력해주세요.');
      return;
    }

    const response = await fetch(`${BASE_URL}/api/users/${userId}/admin-status`);
    const data = await response.json();

    if (response.ok) {
      displayApiResponse('관리자 권한 확인', data);
    } else {
      displayError(`관리자 권한 확인 실패: ${data.error?.message || '알 수 없는 오류'}`);
    }
  } catch (error) {
    console.error('관리자 권한 확인 오류:', error);
    displayError(`관리자 권한 확인 오류: ${error.message}`);
  }
}

/**
 * 관리자 권한 설정 테스트
 */
export async function testSetAdminStatus() {
  try {
    const userId = document.getElementById('admin-set-user-id').value;
    const isAdmin = document.getElementById('admin-status-select').value === 'true';
    
    if (!userId) {
      displayError('사용자 ID를 입력해주세요.');
      return;
    }

    const response = await fetch(`${BASE_URL}/api/users/${userId}/admin-status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        is_admin: isAdmin,
        user_id: 'admin' // 관리자 권한으로 실행
      })
    });
    
    const data = await response.json();

    if (response.ok) {
      displayApiResponse('관리자 권한 설정', data);
    } else {
      displayError(`관리자 권한 설정 실패: ${data.error?.message || '알 수 없는 오류'}`);
    }
  } catch (error) {
    console.error('관리자 권한 설정 오류:', error);
    displayError(`관리자 권한 설정 오류: ${error.message}`);
  }
}

/**
 * 사용자 목록 조회 테스트
 */
export async function testGetUserList() {
  try {
    const limit = parseInt(document.getElementById('user-list-limit').value) || 10;
    const offset = parseInt(document.getElementById('user-list-offset').value) || 0;
    const search = document.getElementById('user-list-search').value;
    const sortBy = document.getElementById('user-list-sort').value;
    const sortOrder = document.getElementById('user-list-order').value;
    const includeInactive = document.getElementById('user-list-include-inactive').checked;

    // 쿼리 파라미터 구성
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
      sort_by: sortBy,
      sort_order: sortOrder,
      include_inactive: includeInactive.toString()
    });

    if (search) {
      params.append('search', search);
    }

    // 관리자 권한 확인을 위한 user_id 추가
    params.append('user_id', 'admin');

    const response = await fetch(`${BASE_URL}/api/users?${params.toString()}`);
    const data = await response.json();

    if (response.ok) {
      displayApiResponse('사용자 목록 조회', data);
    } else {
      displayError(`사용자 목록 조회 실패: ${data.error?.message || '알 수 없는 오류'}`);
    }
  } catch (error) {
    console.error('사용자 목록 조회 오류:', error);
    displayError(`사용자 목록 조회 오류: ${error.message}`);
  }
}

/**
 * 관리자 계정 생성 테스트 (개발용)
 */
export async function testCreateAdminAccount() {
  try {
    // 관리자 계정 회원가입
    const adminData = {
      username: 'Administrator',
      email: 'admin@orbitmate.com',
      password: 'admin123!@#'
    };

    const response = await fetch(`${BASE_URL}/api/users/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(adminData)
    });
    
    const data = await response.json();

    if (response.ok) {
      displayApiResponse('관리자 계정 생성', data);
      
      // 생성된 계정에 관리자 권한 부여
      const adminUserId = data.data.user_id;
      setTimeout(() => {
        document.getElementById('admin-set-user-id').value = adminUserId;
        document.getElementById('admin-status-select').value = 'true';
        testSetAdminStatus();
      }, 1000);
    } else {
      displayError(`관리자 계정 생성 실패: ${data.error?.message || '알 수 없는 오류'}`);
    }
  } catch (error) {
    console.error('관리자 계정 생성 오류:', error);
    displayError(`관리자 계정 생성 오류: ${error.message}`);
  }
}

/**
 * 관리자 기능 통합 테스트
 */
export async function testAdminFunctions() {
  try {
    displayApiResponse('관리자 기능 통합 테스트', { message: '테스트 시작...' });

    // 1. 관리자 권한 확인
    document.getElementById('admin-check-user-id').value = 'admin';
    await testCheckAdminStatus();
    
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 2. 일반 사용자 권한 확인
    document.getElementById('admin-check-user-id').value = 'guest';
    await testCheckAdminStatus();
    
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 3. 사용자 목록 조회
    await testGetUserList();
    
    displayApiResponse('관리자 기능 통합 테스트', { message: '테스트 완료!' });
  } catch (error) {
    console.error('관리자 기능 통합 테스트 오류:', error);
    displayError(`관리자 기능 통합 테스트 오류: ${error.message}`);
  }
}

// 이벤트 리스너 등록 함수
export function setupAdminEventListeners() {
  // 관리자 권한 확인
  document.getElementById('check-admin-status-button')?.addEventListener('click', testCheckAdminStatus);
  
  // 관리자 권한 설정
  document.getElementById('set-admin-status-button')?.addEventListener('click', testSetAdminStatus);
  
  // 사용자 목록 조회
  document.getElementById('get-user-list-button')?.addEventListener('click', testGetUserList);
}
