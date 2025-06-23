// routes/subscriptions.js
const express = require('express');
const router = express.Router();

const {
    getSubscriptionTiersController,
    getUserSubscriptionController,
    updateUserSubscriptionController,
    cancelUserSubscriptionController,
    getUserSubscriptionHistoryController,
    checkFeatureAccessController,
    checkDailyUsageController,
    simulateSubscriptionUpgradeController,
    simulateSubscriptionRenewalController
} = require('../controllers/subscriptionController');

// 구독 등급 목록 조회
router.get('/tiers', getSubscriptionTiersController);

// 사용자 구독 정보 조회
router.get('/users/:user_id/subscription', getUserSubscriptionController);

// 구독 업그레이드/다운그레이드
router.put('/users/:user_id/subscription', updateUserSubscriptionController);

// 구독 취소
router.delete('/users/:user_id/subscription', cancelUserSubscriptionController);

// 구독 이력 조회
router.get('/users/:user_id/subscription/history', getUserSubscriptionHistoryController);

// 기능 접근 권한 확인
router.get('/users/:user_id/subscription/features/:feature_name', checkFeatureAccessController);

// 일일 사용량 확인
router.get('/users/:user_id/subscription/usage', checkDailyUsageController);

//  시뮬레이션 API
router.post('/users/:user_id/subscription/upgrade', simulateSubscriptionUpgradeController);
router.post('/users/:user_id/subscription/renewal', simulateSubscriptionRenewalController);

module.exports = router;
