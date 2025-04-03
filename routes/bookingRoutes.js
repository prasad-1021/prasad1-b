const express = require('express');
const {
  getBookings,
  getUpcomingMeetings,
  getPendingMeetings,
  getCanceledMeetings,
  getPastMeetings,
  getMeetingParticipants,
  refreshBookings
} = require('../controllers/bookingController');

const router = express.Router();

const { protect } = require('../middlewares/authMiddleware');

// Protect all routes
router.use(protect);

// Booking dashboard routes
router.get('/', getBookings);
router.get('/upcoming', getUpcomingMeetings);
router.get('/pending', getPendingMeetings);
router.get('/canceled', getCanceledMeetings);
router.get('/past', getPastMeetings);

// Meeting participants
router.get('/meeting/:id/participants', getMeetingParticipants);

// Refresh booking dashboard
router.put('/refresh', refreshBookings);

module.exports = router; 