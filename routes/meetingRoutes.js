const express = require('express');
const {
  createMeeting,
  getMeetings,
  getMeeting,
  updateMeeting,
  deleteMeeting,
  toggleMeetingStatus,
  respondToInvitation,
  toggleMeetingActive,
  duplicateMeeting,
  checkUserAvailability
} = require('../controllers/meetingController');

const router = express.Router();

const { protect } = require('../middlewares/authMiddleware');

// Protect all routes
router.use(protect);

// Meeting routes
router.route('/')
  .get(getMeetings)
  .post(createMeeting);

router.route('/:id')
  .get(getMeeting)
  .put(updateMeeting)
  .delete(deleteMeeting);

router.put('/:id/toggle', toggleMeetingStatus);

// New route for toggling active status (isActive field)
router.put('/:id/active', toggleMeetingActive);

// New route for duplicating a meeting
router.post('/:id/duplicate', duplicateMeeting);

// Route to check if a meeting time conflicts with user's availability
router.post('/check-availability', checkUserAvailability);

// Invitation response route
router.put('/invitation/:invitationId', respondToInvitation);

module.exports = router; 