// 사용자 활성화 상태 관리 테스트 스크립트
import { displayApiResponse, displayError } from './utils.js';

// 사용자 활성화 상태 조회
export async function getUserActiveStatus() {
  try {
    const userId = document.getElementById('activeStatusUserId').value.trim();
    
    if (!userId) {
      displayError('사용자 ID를 입력해주세요.');
      return;
    }

    console.log('사용자 활성화 상태 조회 시작:', { userId });

    const response = await fetch(`/api/users/${userId}/active-status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    console.log('사용자 활성화 상태 조회 응답:', data);

    if (response.ok) {
      displayApiResponse('사용자 활성화 상태 조회 성공', data);
    } else {
      displayError('사용자 활성화 상태 조회 실패', data);
    }
  } catch (error) {
    console.error('사용자 활성화 상태 조회 오류:', error);
    displayError('사용자 활성화 상태 조회 중 오류가 발생했습니다: ' + error.message);
  }
}

// 사용자 활성화 상태 설정
export async function setUserActiveStatus() {
  try {
    const userId = document.getElementById('activeStatusUserId').value.trim();
    const isActive = document.getElementById('activeStatusValue').checked;
    
    if (!userId) {
      displayError('사용자 ID를 입력해주세요.');
      return;
    }

    console.log('사용자 활성화 상태 설정 시작:', { userId, isActive });

    const response = await fetch(`/api/users/${userId}/active-status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        is_active: isActive
      })
    });

    const data = await response.json();
    console.log('사용자 활성화 상태 설정 응답:', data);

    if (response.ok) {
      displayApiResponse(`사용자 활성화 상태 ${isActive ? '활성화' : '비활성화'} 성공`, data);
    } else {
      displayError('사용자 활성화 상태 설정 실패', data);
    }
  } catch (error) {
    console.error('사용자 활성화 상태 설정 오류:', error);
    displayError('사용자 활성화 상태 설정 중 오류가 발생했습니다: ' + error.message);
  }
}

// 사용자 활성화 상태 토글
export async function toggleUserActiveStatus() {
  try {
    const userId = document.getElementById('activeStatusUserId').value.trim();
    
    if (!userId) {
      displayError('사용자 ID를 입력해주세요.');
      return;
    }

    console.log('사용자 활성화 상태 토글 시작:', { userId });

    const response = await fetch(`/api/users/${userId}/active-status/toggle`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    console.log('사용자 활성화 상태 토글 응답:', data);

    if (response.ok) {
      displayApiResponse('사용자 활성화 상태 토글 성공', data);
    } else {
      displayError('사용자 활성화 상태 토글 실패', data);
    }
  } catch (error) {
    console.error('사용자 활성화 상태 토글 오류:', error);
    displayError('사용자 활성화 상태 토글 중 오류가 발생했습니다: ' + error.message);
  }
}

// 테스트용 사용자 목록 조회 (활성화 상태 포함)
export async function getUserListWithActiveStatus() {
  try {
    console.log('사용자 목록 조회 시작');

    const response = await fetch('/api/users?include_inactive=true&limit=10', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    console.log('사용자 목록 조회 응답:', data);

    if (response.ok) {
      displayApiResponse('사용자 목록 조회 성공 (활성화 상태 포함)', data);
    } else {
      displayError('사용자 목록 조회 실패', data);
    }
  } catch (error) {
    console.error('사용자 목록 조회 오류:', error);
    displayError('사용자 목록 조회 중 오류가 발생했습니다: ' + error.message);
  }
}
