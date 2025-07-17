// 관리자용 세션 전체 조회 기능 테스트

import { displayApiResponse, displayError } from './utils.js';

// 관리자용 전체 세션 조회
export async function getAdminSessions() {
  try {
    const userIdFilter = document.getElementById('admin-session-user-id').value;
    const limit = document.getElementById('admin-session-limit').value || 20;
    const offset = document.getElementById('admin-session-offset').value || 0;
    const includeEmpty = document.getElementById('admin-session-include-empty').checked;
    
    // 쿼리 파라미터 구성
    const params = new URLSearchParams();
    
    if (userIdFilter) {
      params.append('user_id', userIdFilter);
    }
    params.append('limit', limit);
    params.append('offset', offset);
    params.append('include_empty', includeEmpty);

    const response = await fetch(`/api/sessions/admin/all?${params.toString()}`);
    const data = await response.json();

    if (response.ok) {
      displayApiResponse(data, '관리자용 세션 조회 성공');
      
      // 세션 통계 정보 표시
      if (data.data && data.data.sessions) {
        const sessions = data.data.sessions;
        const totalSessions = sessions.length;
        const activeSessions = sessions.filter(s => !s.is_archived).length;
        const archivedSessions = sessions.filter(s => s.is_archived).length;
        
        console.log('📊 세션 통계:');
        console.log(`- 총 세션: ${totalSessions}개`);
        console.log(`- 활성 세션: ${activeSessions}개`);
        console.log(`- 보관 세션: ${archivedSessions}개`);
        
        // 메시지 통계
        const totalMessages = sessions.reduce((sum, s) => sum + (s.message_stats?.total_messages || 0), 0);
        const userMessages = sessions.reduce((sum, s) => sum + (s.message_stats?.user_messages || 0), 0);
        const aiMessages = sessions.reduce((sum, s) => sum + (s.message_stats?.ai_messages || 0), 0);
        
        console.log(`- 총 메시지: ${totalMessages}개`);
        console.log(`- 사용자 메시지: ${userMessages}개`);
        console.log(`- AI 메시지: ${aiMessages}개`);
      }
    } else {
      displayError('관리자용 세션 조회 실패', data);
    }
  } catch (error) {
    displayError('관리자용 세션 조회 중 오류 발생', error);
  }
}

// 세션 정보 상세 표시 (콘솔)
export function displaySessionDetails(sessions) {
  console.log('📋 세션 상세 정보:');
  sessions.forEach((session, index) => {
    console.log(`\n${index + 1}. 세션 ID: ${session.session_id}`);
    console.log(`   제목: ${session.title}`);
    console.log(`   사용자: ${session.user_info?.username} (${session.user_info?.email})`);
    console.log(`   카테고리: ${session.category || '없음'}`);
    console.log(`   생성일: ${session.created_at}`);
    console.log(`   메시지 수: ${session.message_stats?.total_messages || 0}개`);
    console.log(`   활성 상태: ${session.is_archived ? '보관됨' : '활성'}`);
    console.log(`   사용자 활성화: ${session.user_info?.is_active ? '활성' : '비활성'}`);
    console.log(`   관리자 권한: ${session.user_info?.is_admin ? '관리자' : '일반사용자'}`);
    
    if (session.message_stats?.last_message_preview) {
      console.log(`   최근 메시지: ${session.message_stats.last_message_preview.substring(0, 50)}...`);
    }
  });
}

// 이벤트 리스너 등록
export function setupAdminSessionEvents() {
  const getAdminSessionsButton = document.getElementById('get-admin-sessions-button');

  if (getAdminSessionsButton) {
    getAdminSessionsButton.addEventListener('click', getAdminSessions);
  }
}
