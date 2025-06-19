// config/websocket.js - WebSocket 실시간 메시지 처리

const { getConnection } = require('./database');
const { clobToString } = require('../models/chat');

// 활성 사용자 연결 관리
const activeConnections = new Map(); // userId -> Set of socket ids
const socketUsers = new Map(); // socket.id -> userId
const sessionRooms = new Map(); // sessionId -> Set of socket ids

module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log(`WebSocket 연결: ${socket.id}`);

    // 사용자 인증 및 세션 참가
    socket.on('join_session', async (data) => {
      try {
        const { userId, sessionId, userToken } = data;
        console.log(`사용자 ${userId}가 세션 ${sessionId}에 참가 요청`);

        // TODO: 실제 프로덕션에서는 JWT 토큰 검증 필요
        // if (userToken) {
        //   // JWT 토큰 검증 로직
        // }

        // 사용자 연결 정보 저장
        socket.userId = userId;
        socket.sessionId = sessionId;
        socketUsers.set(socket.id, userId);

        // 활성 연결 관리
        if (!activeConnections.has(userId)) {
          activeConnections.set(userId, new Set());
        }
        activeConnections.get(userId).add(socket.id);

        // 세션 룸 관리
        if (!sessionRooms.has(sessionId)) {
          sessionRooms.set(sessionId, new Set());
        }
        sessionRooms.get(sessionId).add(socket.id);

        // Socket.IO 룸에 참가
        socket.join(`session_${sessionId}`);
        socket.join(`user_${userId}`);

        // 참가 확인 응답
        socket.emit('join_session_success', {
          sessionId,
          userId,
          message: '세션에 성공적으로 연결되었습니다.',
          timestamp: new Date().toISOString()
        });

        // 세션의 다른 사용자들에게 새 사용자 참가 알림
        socket.to(`session_${sessionId}`).emit('user_joined', {
          userId,
          sessionId,
          message: `사용자 ${userId}가 세션에 참가했습니다.`,
          timestamp: new Date().toISOString()
        });

        console.log(`사용자 ${userId}가 세션 ${sessionId}에 성공적으로 연결됨`);

      } catch (error) {
        console.error('세션 참가 오류:', error);
        socket.emit('join_session_error', {
          message: '세션 참가에 실패했습니다.',
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    });

    // 실시간 메시지 전송
    socket.on('send_message', async (data) => {
      try {
        const { sessionId, message, messageType = 'user' } = data;
        const userId = socket.userId;

        if (!sessionId || !message || !userId) {
          throw new Error('필수 데이터가 누락되었습니다.');
        }

        console.log(`실시간 메시지 수신: ${userId} -> 세션 ${sessionId}`);

        // 메시지를 세션의 모든 사용자에게 브로드캐스트
        const messageData = {
          sessionId,
          userId,
          message,
          messageType,
          timestamp: new Date().toISOString(),
          socketId: socket.id
        };

        // 같은 세션의 모든 사용자에게 메시지 전송 (본인 포함)
        io.to(`session_${sessionId}`).emit('new_message', messageData);

        console.log(`메시지 브로드캐스트 완료: 세션 ${sessionId}`);

      } catch (error) {
        console.error('메시지 전송 오류:', error);
        socket.emit('message_error', {
          message: '메시지 전송에 실패했습니다.',
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    });

    // 타이핑 상태 알림
    socket.on('typing_start', (data) => {
      const { sessionId } = data;
      const userId = socket.userId;
      
      if (sessionId && userId) {
        socket.to(`session_${sessionId}`).emit('user_typing', {
          userId,
          sessionId,
          isTyping: true,
          timestamp: new Date().toISOString()
        });
      }
    });

    socket.on('typing_stop', (data) => {
      const { sessionId } = data;
      const userId = socket.userId;
      
      if (sessionId && userId) {
        socket.to(`session_${sessionId}`).emit('user_typing', {
          userId,
          sessionId,
          isTyping: false,
          timestamp: new Date().toISOString()
        });
      }
    });

    // AI 스트리밍 메시지 요청 처리
    socket.on('ai_streaming_request', async (data) => {
      try {
        console.log('AI 스트리밍 요청 받음:', data);
        
        const { sessionId, userId, message, ai_provider, systemPrompt, ollama_model, specialModeType } = data;
        
        if (!sessionId || !userId || !message) {
          socket.emit('streaming_error', {
            error: '필수 데이터가 누락되었습니다.',
            timestamp: new Date().toISOString()
          });
          return;
        }

        // AI Provider 및 스트리밍 콜백 설정
        const { fetchChatCompletion } = require('../utils/aiProvider');
        
        // 스트리밍 콜백 함수 정의
        const streamResponseCallback = (chunk) => {
          // 실시간으로 클라이언트에게 청크 전송
          socket.emit('streaming_message', {
            sessionId,
            delta: chunk,
            timestamp: new Date().toISOString()
          });
        };

        // 대화 기록 조회
        const connection = await getConnection();
        const { getChatHistoryFromDB } = require('../models/chat');
        const chatHistory = await getChatHistoryFromDB(connection, sessionId, false);
        
        // AI 응답 요청 (스트리밍 모드)
        const aiResponse = await fetchChatCompletion(
          ai_provider || 'geminiapi',
          message,
          chatHistory,
          systemPrompt,
          'stream', // 강제로 스트리밍 모드
          streamResponseCallback,
          {
            ollamaModel: ollama_model,
            max_output_tokens_override: 2048
          }
        );

        // 스트리밍 완료 알림
        socket.emit('message_complete', {
          sessionId,
          messageId: aiResponse?.ai_message_id || null,
          totalTokens: aiResponse?.total_tokens || 0,
          timestamp: new Date().toISOString()
        });

        await connection.close();

      } catch (error) {
        console.error('AI 스트리밍 오류:', error);
        socket.emit('streaming_error', {
          error: error.message || '스트리밍 중 오류가 발생했습니다.',
          timestamp: new Date().toISOString()
        });
      }
    });

    // 세션 나가기
    socket.on('leave_session', (data) => {
      const { sessionId } = data;
      const userId = socket.userId;
      
      if (sessionId && userId) {
        handleLeaveSession(socket, sessionId, userId);
      }
    });

    // 연결 해제 처리
    socket.on('disconnect', () => {
      console.log(`WebSocket 연결 해제: ${socket.id}`);
      
      const userId = socketUsers.get(socket.id);
      const sessionId = socket.sessionId;
      
      if (userId && sessionId) {
        handleLeaveSession(socket, sessionId, userId);
      }
      
      // 전역 연결 정보 정리
      socketUsers.delete(socket.id);
      if (userId && activeConnections.has(userId)) {
        activeConnections.get(userId).delete(socket.id);
        if (activeConnections.get(userId).size === 0) {
          activeConnections.delete(userId);
        }
      }
    });

    // 온라인 사용자 목록 요청
    socket.on('get_online_users', (data) => {
      const { sessionId } = data;
      
      if (sessionId && sessionRooms.has(sessionId)) {
        const sessionSockets = sessionRooms.get(sessionId);
        const onlineUsers = [];
        
        sessionSockets.forEach(socketId => {
          const userId = socketUsers.get(socketId);
          if (userId && !onlineUsers.includes(userId)) {
            onlineUsers.push(userId);
          }
        });
        
        socket.emit('online_users', {
          sessionId,
          users: onlineUsers,
          count: onlineUsers.length,
          timestamp: new Date().toISOString()
        });
      }
    });
  });

  // 도우미 함수들
  function handleLeaveSession(socket, sessionId, userId) {
    // Socket.IO 룸에서 나가기
    socket.leave(`session_${sessionId}`);
    socket.leave(`user_${userId}`);
    
    // 세션 룸 관리에서 제거
    if (sessionRooms.has(sessionId)) {
      sessionRooms.get(sessionId).delete(socket.id);
      if (sessionRooms.get(sessionId).size === 0) {
        sessionRooms.delete(sessionId);
      }
    }
    
    // 다른 사용자들에게 나가기 알림
    socket.to(`session_${sessionId}`).emit('user_left', {
      userId,
      sessionId,
      message: `사용자 ${userId}가 세션을 떠났습니다.`,
      timestamp: new Date().toISOString()
    });
    
    console.log(`사용자 ${userId}가 세션 ${sessionId}에서 나감`);
  }

  // 외부에서 메시지 브로드캐스트할 수 있는 함수 (REST API에서 사용)
  function broadcastToSession(sessionId, event, data) {
    io.to(`session_${sessionId}`).emit(event, data);
    console.log(`세션 ${sessionId}에 이벤트 ${event} 브로드캐스트`);
  }

  function broadcastToUser(userId, event, data) {
    io.to(`user_${userId}`).emit(event, data);
    console.log(`사용자 ${userId}에게 이벤트 ${event} 전송`);
  }

  // 연결 상태 모니터링 함수들
  function getActiveConnections() {
    return {
      totalConnections: io.engine.clientsCount,
      userConnections: activeConnections.size,
      sessionRooms: sessionRooms.size,
      connectionDetails: {
        activeConnections: Object.fromEntries(activeConnections),
        sessionRooms: Object.fromEntries(sessionRooms),
        socketUsers: Object.fromEntries(socketUsers)
      }
    };
  }

  // WebSocket 인스턴스와 유틸리티 함수들을 외부에서 사용할 수 있도록 내보내기
  io.broadcastToSession = broadcastToSession;
  io.broadcastToUser = broadcastToUser;
  io.getActiveConnections = getActiveConnections;

  console.log('WebSocket 서버가 초기화되었습니다.');
  
  return io;
};
