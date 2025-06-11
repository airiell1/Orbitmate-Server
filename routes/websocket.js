// routes/websocket.js - WebSocket 관련 API 라우트

const express = require('express');
const router = express.Router();

// WebSocket 인스턴스를 저장할 변수
let io = null;

// WebSocket 인스턴스 설정 함수
function setSocketIO(socketIOInstance) {
  io = socketIOInstance;
}

// WebSocket 연결 상태 조회 API
router.get('/status', (req, res) => {
  try {
    if (!io) {
      return res.status(503).json({
        error: {
          code: 'WEBSOCKET_NOT_AVAILABLE',
          message: 'WebSocket 서버가 초기화되지 않았습니다.'
        }
      });
    }

    const connectionInfo = io.getActiveConnections();
    
    res.json({
      websocket_status: 'active',
      server_info: {
        total_connections: connectionInfo.totalConnections,
        active_users: connectionInfo.userConnections,
        active_sessions: connectionInfo.sessionRooms,
        timestamp: new Date().toISOString()
      },
      connection_details: connectionInfo.connectionDetails
    });
  } catch (error) {
    console.error('WebSocket 상태 조회 오류:', error);
    res.status(500).json({
      error: {
        code: 'SERVER_ERROR',
        message: 'WebSocket 상태 조회 중 오류가 발생했습니다.'
      }
    });
  }
});

// 특정 세션에 메시지 브로드캐스트 API
router.post('/broadcast/session/:session_id', (req, res) => {
  try {
    const { session_id } = req.params;
    const { event, data } = req.body;

    if (!session_id || !event || !data) {
      return res.status(400).json({
        error: {
          code: 'INVALID_INPUT',
          message: '세션 ID, 이벤트명, 데이터가 모두 필요합니다.'
        }
      });
    }

    if (!io) {
      return res.status(503).json({
        error: {
          code: 'WEBSOCKET_NOT_AVAILABLE',
          message: 'WebSocket 서버가 사용할 수 없습니다.'
        }
      });
    }

    io.broadcastToSession(session_id, event, {
      ...data,
      broadcast_timestamp: new Date().toISOString(),
      from_api: true
    });

    res.json({
      message: '메시지가 성공적으로 브로드캐스트되었습니다.',
      session_id,
      event,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('브로드캐스트 오류:', error);
    res.status(500).json({
      error: {
        code: 'SERVER_ERROR',
        message: '브로드캐스트 중 오류가 발생했습니다.'
      }
    });
  }
});

// 특정 사용자에게 메시지 전송 API
router.post('/send/user/:user_id', (req, res) => {
  try {
    const { user_id } = req.params;
    const { event, data } = req.body;

    if (!user_id || !event || !data) {
      return res.status(400).json({
        error: {
          code: 'INVALID_INPUT',
          message: '사용자 ID, 이벤트명, 데이터가 모두 필요합니다.'
        }
      });
    }

    if (!io) {
      return res.status(503).json({
        error: {
          code: 'WEBSOCKET_NOT_AVAILABLE',
          message: 'WebSocket 서버가 사용할 수 없습니다.'
        }
      });
    }

    io.broadcastToUser(user_id, event, {
      ...data,
      send_timestamp: new Date().toISOString(),
      from_api: true
    });

    res.json({
      message: '메시지가 성공적으로 전송되었습니다.',
      user_id,
      event,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('사용자 메시지 전송 오류:', error);
    res.status(500).json({
      error: {
        code: 'SERVER_ERROR',
        message: '메시지 전송 중 오류가 발생했습니다.'
      }
    });
  }
});

// WebSocket 이벤트 테스트 API
router.post('/test/event', (req, res) => {
  try {
    const { session_id, user_id, event_type = 'test_message' } = req.body;

    if (!session_id && !user_id) {
      return res.status(400).json({
        error: {
          code: 'INVALID_INPUT',
          message: '세션 ID 또는 사용자 ID 중 하나는 필수입니다.'
        }
      });
    }

    if (!io) {
      return res.status(503).json({
        error: {
          code: 'WEBSOCKET_NOT_AVAILABLE',
          message: 'WebSocket 서버가 사용할 수 없습니다.'
        }
      });
    }

    const testData = {
      message: 'WebSocket 테스트 메시지입니다.',
      test_timestamp: new Date().toISOString(),
      from_api: true,
      test_id: `test_${Date.now()}`
    };

    if (session_id) {
      io.broadcastToSession(session_id, event_type, testData);
      res.json({
        message: '세션 테스트 메시지가 전송되었습니다.',
        target: { session_id },
        event_type,
        test_data: testData
      });
    } else if (user_id) {
      io.broadcastToUser(user_id, event_type, testData);
      res.json({
        message: '사용자 테스트 메시지가 전송되었습니다.',
        target: { user_id },
        event_type,
        test_data: testData
      });
    }

  } catch (error) {
    console.error('WebSocket 테스트 오류:', error);
    res.status(500).json({
      error: {
        code: 'SERVER_ERROR',
        message: 'WebSocket 테스트 중 오류가 발생했습니다.'
      }
    });
  }
});

module.exports = { router, setSocketIO };
