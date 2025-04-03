const express = require('express');
const {
  getAvailability,
  updateAvailability,
  updateDayAvailability,
  updateWeekendAvailability,
  copyTimeSlots,
  getTimezone,
  updateTimezone,
  updateEventType,
  getPreferences,
  getEventType,
  updateProfile,
  updatePassword,
  updatePasswordNoVerification
} = require('../controllers/userController');

const router = express.Router();

const { protect } = require('../middlewares/authMiddleware');

// Protect all routes
router.use(protect);

// User profile route
router.route('/profile')
  .put(updateProfile);

router.route('/password')
  .put(updatePassword);

router.route('/password/reset')
  .put(updatePasswordNoVerification);

// Availability routes
router.route('/availability')
  .get(getAvailability)
  .put(updateAvailability);

router.route('/availability/copy')
  .post(copyTimeSlots);

router.route('/availability/weekend')
  .put(updateWeekendAvailability);

router.route('/availability/:day')
  .put(updateDayAvailability);

// Preferences routes
router.route('/preferences')
  .get(getPreferences);

router.route('/preferences/timezone')
  .get(getTimezone)
  .put(updateTimezone);

router.route('/preferences/eventType')
  .get(getEventType)
  .put(updateEventType);

module.exports = router; 