const express = require('express');
const { protect } = require('../middlewares/authMiddleware');
const { 
  createMeeting: createEvent, 
  getMeetings: getEvents,
  getUserCreatedMeetings: getUserCreatedEvents 
} = require('../controllers/meetingController');

const router = express.Router();

// Log middleware to verify token
router.use((req, res, next) => {
  console.log('Token received:', req.headers.authorization);
  next();
});

// Protect all routes
router.use(protect);

// Event routes
router.route('/')
  .get(getEvents)
  .post(createEvent);

// Get only events created by the current user (for event types)
router.route('/created')
  .get(getUserCreatedEvents);

module.exports = router; 