// testScripts/post.js
import { displayApiResponse, displayError } from './utils.js';

const API_BASE_URL = 'http://localhost:3000/api';

/**
 * 게시물 생성 테스트
 */
export async function createPost() {
  try {
    const userName = document.getElementById('post-user-id').value;
    const subject = document.getElementById('post-subject').value;
    const content = document.getElementById('post-content').value;
    const password = document.getElementById('post-password').value;
    const originLanguage = document.getElementById('post-origin-language').value;
    const isNotice = document.getElementById('post-is-notice').checked;

    if (!userName || !subject || !content) {
      displayError('사용자 이름, 제목, 내용을 모두 입력해주세요.');
      return;
    }

    if (!isNotice && !password) {
      displayError('일반 게시물은 비밀번호가 필요합니다.');
      return;
    }

    const postData = {
      user_name: userName,
      subject: subject,
      content: content,
      password: password,
      origin_language: originLanguage,
      is_notice: isNotice
    };

    const response = await fetch(`${API_BASE_URL}/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(postData)
    });

    const data = await response.json();
    
    if (response.ok) {
      displayApiResponse('게시물 생성 성공', data);
      // 생성된 게시물 ID를 다른 입력 필드에 자동 입력
      if (data.data && data.data.post_id) {
        document.getElementById('post-detail-id').value = data.data.post_id;
        document.getElementById('update-post-id').value = data.data.post_id;
        document.getElementById('translate-post-id').value = data.data.post_id;
      }
    } else {
      displayError('게시물 생성 실패', data);
    }
  } catch (error) {
    displayError('게시물 생성 오류', error);
  }
}

/**
 * 게시물 목록 조회 테스트
 */
export async function getPostList() {
  try {
    const language = document.getElementById('post-list-language').value;
    const page = document.getElementById('post-list-page').value;
    const limit = document.getElementById('post-list-limit').value;

    const params = new URLSearchParams({
      language: language,
      page: page,
      limit: limit
    });

    const response = await fetch(`${API_BASE_URL}/posts?${params}`);
    const data = await response.json();
    
    if (response.ok) {
      displayApiResponse(`게시물 목록 조회 성공 (${language})`, data);
      
      // 첫 번째 게시물 ID를 다른 입력 필드에 자동 입력
      if (data.data && data.data.length > 0) {
        const firstPostId = data.data[0].post_id;
        document.getElementById('post-detail-id').value = firstPostId;
        document.getElementById('update-post-id').value = firstPostId;
        document.getElementById('translate-post-id').value = firstPostId;
      }
    } else {
      displayError('게시물 목록 조회 실패', data);
    }
  } catch (error) {
    displayError('게시물 목록 조회 오류', error);
  }
}

/**
 * 게시물 상세 조회 테스트
 */
export async function getPostDetail() {
  try {
    const postId = document.getElementById('post-detail-id').value;
    const language = document.getElementById('post-detail-language').value;

    if (!postId) {
      displayError('게시물 ID를 입력해주세요.');
      return;
    }

    const params = new URLSearchParams({
      language: language
    });

    const response = await fetch(`${API_BASE_URL}/posts/${postId}?${params}`);
    const data = await response.json();
    
    if (response.ok) {
      displayApiResponse(`게시물 상세 조회 성공 (${language})`, data);
      
      // 번역 정보 표시
      if (data.data) {
        const post = data.data;
        if (post.needs_translation) {
          displayApiResponse('번역 상태', '번역이 필요합니다. AI 번역을 요청해보세요.');
        } else if (post.translation) {
          displayApiResponse('번역 정보', {
            method: post.translation.translation_method,
            is_original: post.translation.is_original
          });
        }
      }
    } else {
      displayError('게시물 상세 조회 실패', data);
    }
  } catch (error) {
    displayError('게시물 상세 조회 오류', error);
  }
}

/**
 * 게시물 수정 테스트
 */
export async function updatePost() {
  try {
    const postId = document.getElementById('update-post-id').value;
    const userName = document.getElementById('update-post-user-id').value;
    const subject = document.getElementById('update-post-subject').value;
    const content = document.getElementById('update-post-content').value;
    const password = document.getElementById('update-post-password').value;

    if (!postId || !userName || !subject || !content) {
      displayError('게시물 ID, 사용자 이름, 제목, 내용을 모두 입력해주세요.');
      return;
    }

    const updateData = {
      user_name: userName,
      subject: subject,
      content: content,
      password: password
    };

    const response = await fetch(`${API_BASE_URL}/posts/${postId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateData)
    });

    const data = await response.json();
    
    if (response.ok) {
      displayApiResponse('게시물 수정 성공', data);
    } else {
      displayError('게시물 수정 실패', data);
    }
  } catch (error) {
    displayError('게시물 수정 오류', error);
  }
}

/**
 * 게시물 삭제 테스트
 */
export async function deletePost() {
  try {
    const postId = document.getElementById('update-post-id').value;
    const userName = document.getElementById('update-post-user-id').value;
    const password = document.getElementById('update-post-password').value;

    if (!postId || !userName) {
      displayError('게시물 ID와 사용자 이름을 입력해주세요.');
      return;
    }

    const deleteData = {
      user_name: userName,
      password: password
    };

    const response = await fetch(`${API_BASE_URL}/posts/${postId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(deleteData)
    });

    const data = await response.json();
    
    if (response.ok) {
      displayApiResponse('게시물 삭제 성공', data);
    } else {
      displayError('게시물 삭제 실패', data);
    }
  } catch (error) {
    displayError('게시물 삭제 오류', error);
  }
}

/**
 * 게시물 번역 요청 테스트
 */
export async function translatePost() {
  try {
    const postId = document.getElementById('translate-post-id').value;
    const language = document.getElementById('translate-language').value;

    if (!postId || !language) {
      displayError('게시물 ID와 언어를 선택해주세요.');
      return;
    }

    const translateData = {
      language: language
    };

    displayApiResponse('번역 요청', 'AI 번역을 요청했습니다. 잠시 기다려주세요...');

    const response = await fetch(`${API_BASE_URL}/posts/${postId}/translate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(translateData)
    });

    const data = await response.json();
    
    if (response.ok) {
      displayApiResponse('AI 번역 완료', data);
      
      // 번역 결과 표시
      if (data.data && data.data.translation) {
        displayApiResponse('번역 결과', {
          subject: data.data.translation.subject,
          content: data.data.translation.content,
          method: data.data.translation.translation_method
        });
      }
    } else {
      displayError('게시물 번역 실패', data);
    }
  } catch (error) {
    displayError('게시물 번역 오류', error);
  }
}

/**
 * 게시물 관리 기능 시연
 */
export async function demonstratePostSystem() {
  try {
    displayApiResponse('게시물 시스템 시연', '다국어 게시물 관리 시스템을 시연합니다...');
    
    // 1. 한국어 게시물 생성
    document.getElementById('post-user-id').value = 'demo_user';
    document.getElementById('post-subject').value = '시연용 게시물';
    document.getElementById('post-content').value = '안녕하세요! 오빗메이트 다국어 게시판 시연입니다.';
    document.getElementById('post-password').value = 'demo123';
    document.getElementById('post-origin-language').value = 'ko';
    document.getElementById('post-is-notice').checked = false;
    
    await createPost();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 2. 영어로 번역 요청
    document.getElementById('translate-language').value = 'en';
    await translatePost();
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 3. 일본어로 번역 요청
    document.getElementById('translate-language').value = 'ja';
    await translatePost();
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 4. 다양한 언어로 목록 조회
    const languages = ['ko', 'en', 'ja'];
    for (const lang of languages) {
      document.getElementById('post-list-language').value = lang;
      await getPostList();
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    displayApiResponse('시연 완료', '다국어 게시물 관리 시스템 시연이 완료되었습니다.');
    
  } catch (error) {
    displayError('시연 오류', error);
  }
}
