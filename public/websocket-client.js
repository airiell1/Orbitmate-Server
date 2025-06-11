// public/websocket-client.js - WebSocket 클라이언트 구현

class OrbitWebSocket {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.currentSessionId = null;
    this.currentUserId = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000; // 1초
    
    // 이벤트 리스너들
    this.eventListeners = new Map();
    
    this.init();
  }

  init() {
    try {
      // Socket.IO 연결 설정
      this.socket = io({
        transports: ['websocket', 'polling'],
        timeout: 20000,
        reconnection: true,
        reconnectionDelay: this.reconnectDelay,
        reconnectionAttempts: this.maxReconnectAttempts
      });

      this.setupEventListeners();
      this.setupConnectionHandlers();
      
    } catch (error) {
      console.error('WebSocket 초기화 실패:', error);
      this.handleConnectionError(error);
    }
  }

  setupConnectionHandlers() {
    // 연결 성공
    this.socket.on('connect', () => {
      console.log('WebSocket 연결 성공:', this.socket.id);
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      // 연결 상태 UI 업데이트
      this.updateConnectionStatus('connected');
      
      // 이전에 참가했던 세션이 있으면 자동 재참가
      if (this.currentSessionId && this.currentUserId) {
        this.joinSession(this.currentSessionId, this.currentUserId);
      }
    });

    // 연결 해제
    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket 연결 해제:', reason);
      this.isConnected = false;
      this.updateConnectionStatus('disconnected');
    });

    // 연결 오류
    this.socket.on('connect_error', (error) => {
      console.error('WebSocket 연결 오류:', error);
      this.isConnected = false;
      this.reconnectAttempts++;
      this.updateConnectionStatus('error');
      this.handleConnectionError(error);
    });

    // 재연결 시도
    this.socket.on('reconnect_attempt', (attemptNumber) => {
      console.log(`WebSocket 재연결 시도 ${attemptNumber}/${this.maxReconnectAttempts}`);
      this.updateConnectionStatus('reconnecting', attemptNumber);
    });

    // 재연결 성공
    this.socket.on('reconnect', (attemptNumber) => {
      console.log(`WebSocket 재연결 성공 (시도 횟수: ${attemptNumber})`);
      this.reconnectAttempts = 0;
      this.updateConnectionStatus('connected');
    });

    // 재연결 실패
    this.socket.on('reconnect_failed', () => {
      console.error('WebSocket 재연결 실패');
      this.updateConnectionStatus('failed');
    });
  }

  setupEventListeners() {
    // 세션 참가 성공
    this.socket.on('join_session_success', (data) => {
      console.log('세션 참가 성공:', data);
      this.emit('sessionJoined', data);
    });

    // 세션 참가 실패
    this.socket.on('join_session_error', (data) => {
      console.error('세션 참가 실패:', data);
      this.emit('sessionJoinError', data);
    });

    // 새 사용자 참가 알림
    this.socket.on('user_joined', (data) => {
      console.log('새 사용자 참가:', data);
      this.emit('userJoined', data);
    });

    // 사용자 나가기 알림
    this.socket.on('user_left', (data) => {
      console.log('사용자 나가기:', data);
      this.emit('userLeft', data);
    });

    // 실시간 메시지 수신
    this.socket.on('new_message', (data) => {
      console.log('실시간 메시지 수신:', data);
      this.handleNewMessage(data);
    });

    // API를 통한 새 메시지 (DB 저장된 메시지)
    this.socket.on('new_message_from_api', (data) => {
      console.log('API 메시지 수신:', data);
      this.handleNewMessage(data);
    });

    // 타이핑 상태 알림
    this.socket.on('user_typing', (data) => {
      console.log('타이핑 상태:', data);
      this.emit('userTyping', data);
    });

    // 온라인 사용자 목록
    this.socket.on('online_users', (data) => {
      console.log('온라인 사용자:', data);
      this.emit('onlineUsers', data);
    });

    // 메시지 전송 오류
    this.socket.on('message_error', (data) => {
      console.error('메시지 오류:', data);
      this.emit('messageError', data);
    });

    // 테스트 메시지
    this.socket.on('test_message', (data) => {
      console.log('테스트 메시지 수신:', data);
      this.emit('testMessage', data);
    });
  }

  // 세션 참가
  joinSession(sessionId, userId, userToken = null) {
    if (!this.isConnected) {
      console.warn('WebSocket이 연결되지 않았습니다.');
      return false;
    }

    this.currentSessionId = sessionId;
    this.currentUserId = userId;

    this.socket.emit('join_session', {
      sessionId,
      userId,
      userToken,
      timestamp: new Date().toISOString()
    });

    return true;
  }

  // 세션 나가기
  leaveSession() {
    if (!this.isConnected || !this.currentSessionId) {
      return false;
    }

    this.socket.emit('leave_session', {
      sessionId: this.currentSessionId,
      timestamp: new Date().toISOString()
    });

    this.currentSessionId = null;
    return true;
  }

  // 실시간 메시지 전송
  sendMessage(message, messageType = 'user') {
    if (!this.isConnected || !this.currentSessionId) {
      console.warn('세션에 참가하지 않았거나 연결이 끊어졌습니다.');
      return false;
    }

    this.socket.emit('send_message', {
      sessionId: this.currentSessionId,
      message,
      messageType,
      timestamp: new Date().toISOString()
    });

    return true;
  }

  // 타이핑 시작 알림
  startTyping() {
    if (!this.isConnected || !this.currentSessionId) return false;

    this.socket.emit('typing_start', {
      sessionId: this.currentSessionId,
      timestamp: new Date().toISOString()
    });

    return true;
  }

  // 타이핑 중지 알림
  stopTyping() {
    if (!this.isConnected || !this.currentSessionId) return false;

    this.socket.emit('typing_stop', {
      sessionId: this.currentSessionId,
      timestamp: new Date().toISOString()
    });

    return true;
  }

  // 온라인 사용자 목록 요청
  getOnlineUsers() {
    if (!this.isConnected || !this.currentSessionId) return false;

    this.socket.emit('get_online_users', {
      sessionId: this.currentSessionId,
      timestamp: new Date().toISOString()
    });

    return true;
  }

  // 새 메시지 처리
  handleNewMessage(data) {
    // 자신이 보낸 메시지는 중복 처리하지 않음
    if (data.socketId === this.socket.id) {
      return;
    }

    // 메시지를 UI에 추가
    this.emit('newMessage', data);
  }

  // 이벤트 리스너 등록
  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(callback);
  }

  // 이벤트 발생
  emit(event, data) {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`이벤트 ${event} 처리 중 오류:`, error);
        }
      });
    }
  }

  // 이벤트 리스너 제거
  off(event, callback) {
    if (this.eventListeners.has(event)) {
      const listeners = this.eventListeners.get(event);
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  // 연결 상태 UI 업데이트
  updateConnectionStatus(status, extra = null) {
    const statusElement = document.getElementById('websocket-status');
    if (!statusElement) return;

    const statusConfig = {
      connected: { text: '실시간 연결됨', class: 'ws-connected', color: '#28a745' },
      disconnected: { text: '연결 끊어짐', class: 'ws-disconnected', color: '#dc3545' },
      reconnecting: { text: `재연결 중 (${extra}/${this.maxReconnectAttempts})`, class: 'ws-reconnecting', color: '#ffc107' },
      error: { text: '연결 오류', class: 'ws-error', color: '#dc3545' },
      failed: { text: '연결 실패', class: 'ws-failed', color: '#dc3545' }
    };

    const config = statusConfig[status] || statusConfig.disconnected;
    
    statusElement.textContent = config.text;
    statusElement.className = `websocket-status ${config.class}`;
    statusElement.style.color = config.color;
  }

  // 연결 오류 처리
  handleConnectionError(error) {
    console.error('WebSocket 오류:', error);
    
    // 오류 메시지를 사용자에게 표시
    this.emit('connectionError', {
      error: error.message,
      attempts: this.reconnectAttempts,
      maxAttempts: this.maxReconnectAttempts
    });
  }

  // 연결 상태 확인
  isWebSocketConnected() {
    return this.isConnected && this.socket && this.socket.connected;
  }

  // WebSocket 연결 해제
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.isConnected = false;
      this.currentSessionId = null;
      this.currentUserId = null;
    }
  }

  // 현재 상태 정보
  getStatus() {
    return {
      isConnected: this.isConnected,
      currentSessionId: this.currentSessionId,
      currentUserId: this.currentUserId,
      socketId: this.socket ? this.socket.id : null,
      reconnectAttempts: this.reconnectAttempts
    };
  }
}

// 전역 WebSocket 인스턴스 생성
let orbitWebSocket = null;

// WebSocket 초기화 함수
function initializeWebSocket() {
  if (!orbitWebSocket) {
    orbitWebSocket = new OrbitWebSocket();
    
    // 전역 이벤트 리스너들 설정
    setupGlobalWebSocketListeners();
  }
  return orbitWebSocket;
}

// 전역 WebSocket 이벤트 리스너 설정
function setupGlobalWebSocketListeners() {
  if (!orbitWebSocket) return;

  // 새 메시지 처리
  orbitWebSocket.on('newMessage', (data) => {
    if (typeof addMessage === 'function') {
      const sender = data.message_type === 'user' ? 'user' : 'ai';
      addMessage(sender, data.message_content, data.message_id, false, true); // 마지막 true는 실시간 메시지 표시
    }
  });

  // 사용자 참가/나가기 알림
  orbitWebSocket.on('userJoined', (data) => {
    if (typeof addMessage === 'function') {
      addMessage('system', `${data.userId}님이 참가했습니다.`);
    }
  });

  orbitWebSocket.on('userLeft', (data) => {
    if (typeof addMessage === 'function') {
      addMessage('system', `${data.userId}님이 나갔습니다.`);
    }
  });

  // 타이핑 상태 표시
  orbitWebSocket.on('userTyping', (data) => {
    updateTypingIndicator(data.userId, data.isTyping);
  });

  // 연결 오류 처리
  orbitWebSocket.on('connectionError', (data) => {
    console.error('WebSocket 연결 오류:', data);
    if (typeof addMessage === 'function') {
      addMessage('system', `실시간 연결 오류: ${data.error} (재시도 ${data.attempts}/${data.maxAttempts})`);
    }
  });
}

// 타이핑 인디케이터 업데이트
function updateTypingIndicator(userId, isTyping) {
  const typingElement = document.getElementById('typing-indicator');
  if (!typingElement) return;

  if (isTyping) {
    typingElement.textContent = `${userId}님이 입력 중...`;
    typingElement.style.display = 'block';
  } else {
    typingElement.style.display = 'none';
  }
}

// WebSocket 인스턴스 가져오기
function getOrbitWebSocket() {
  return orbitWebSocket || initializeWebSocket();
}

// 전역으로 내보내기
if (typeof window !== 'undefined') {
  window.OrbitWebSocket = OrbitWebSocket;
  window.initializeWebSocket = initializeWebSocket;
  window.getOrbitWebSocket = getOrbitWebSocket;
}
