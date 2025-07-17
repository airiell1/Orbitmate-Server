// 사용자 활성화 상태 관리 기능 테스트

import { displayApiResponse, displayError } from './utils.js';

// 사용자 활성화 상태 확인
export async function checkActiveStatus() {
  try {
    const userId = document.getElementById('active-check-user-id').value;
    
    if (!userId) {
      displayError('사용자 ID를 입력해주세요.');
      return;
    }

    const response = await fetch(`/api/users/${userId}/active-status`);
    const data = await response.json();

    if (response.ok) {
      displayApiResponse(data, '사용자 활성화 상태 확인 성공');
    } else {
      displayError('사용자 활성화 상태 확인 실패', data);
    }
  } catch (error) {
    displayError('사용자 활성화 상태 확인 중 오류 발생', error);
  }
}

// 사용자 활성화 상태 설정
export async function setActiveStatus() {
  try {
    const userId = document.getElementById('active-set-user-id').value;
    const isActive = document.getElementById('active-status-select').value === 'true';
    
    if (!userId) {
      displayError('사용자 ID를 입력해주세요.');
      return;
    }

    const response = await fetch(`/api/users/${userId}/active-status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        is_active: isActive
      }),
    });

    const data = await response.json();

    if (response.ok) {
      displayApiResponse(data, '사용자 활성화 상태 설정 성공');
    } else {
      displayError('사용자 활성화 상태 설정 실패', data);
    }
  } catch (error) {
    displayError('사용자 활성화 상태 설정 중 오류 발생', error);
  }
}

// 이벤트 리스너 등록
export function setupUserActiveEvents() {
  const checkActiveStatusButton = document.getElementById('check-active-status-button');
  const setActiveStatusButton = document.getElementById('set-active-status-button');

  if (checkActiveStatusButton) {
    checkActiveStatusButton.addEventListener('click', checkActiveStatus);
  }

  if (setActiveStatusButton) {
    setActiveStatusButton.addEventListener('click', setActiveStatus);
  }
}
