const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const Booking = require('../models/Booking');

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
exports.register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  // Generate username from name
  const baseUsername = name.toLowerCase().split(' ')[0];
  let username = baseUsername;
  let counter = 1;

  // Check if username exists and generate a unique one
  while (await User.findOne({ username })) {
    username = `${baseUsername}${counter}`;
    counter++;
  }

  // Create user
  const user = await User.create({
    name,
    email,
    password,
    username
  });

  // Create an empty booking dashboard for the user
  await Booking.create({
    userId: user._id,
    upcomingMeetings: [],
    pendingMeetings: [],
    canceledMeetings: [],
    pastMeetings: []
  });

  // Initialize default availability
  const defaultAvailability = [
    'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'
  ].map(day => ({
    day,
    isAvailable: true,
    slots: [{ startTime: '09:00', endTime: '17:00' }]
  })).concat([
    'Saturday', 'Sunday'
  ].map(day => ({
    day,
    isAvailable: false,
    slots: []
  })));

  user.availability = defaultAvailability;
  await user.save();

  sendTokenResponse(user, 201, res);
});

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  // Validate username & password
  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: 'Please provide username and password'
    });
  }

  // Check for user by username
  const user = await User.findOne({ username }).select('+password');

  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  }

  // Check if password matches
  const isMatch = await user.matchPassword(password);

  if (!isMatch) {
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  }

  sendTokenResponse(user, 200, res);
});

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);

  res.status(200).json({
    success: true,
    data: user
  });
});

// @desc    Update user details
// @route   PUT /api/auth/updatedetails
// @access  Private
exports.updateDetails = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).select('+password');
  const fieldsToUpdate = {
    name: req.body.name,
    email: req.body.email
  };

  // If email is being changed, increment token version
  if (req.body.email && req.body.email !== user.email) {
    user.tokenVersion += 1;
    await user.save();
  }

  const updatedUser = await User.findByIdAndUpdate(req.user.id, fieldsToUpdate, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    success: true,
    data: updatedUser,
    token: user.getSignedJwtToken() // Send new token with updated version
  });
});

// @desc    Update password
// @route   PUT /api/auth/updatepassword
// @access  Private
exports.updatePassword = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).select('+password');

  // Check current password
  if (!(await user.matchPassword(req.body.currentPassword))) {
    return res.status(401).json({
      success: false,
      message: 'Password is incorrect'
    });
  }

  user.password = req.body.newPassword;
  // tokenVersion will be automatically incremented in the pre-save hook
  await user.save();

  sendTokenResponse(user, 200, res);
});

// @desc    Logout user / clear cookie
// @route   POST /api/auth/logout
// @access  Private
exports.logout = asyncHandler(async (req, res) => {
  // Increment token version to invalidate existing tokens
  const user = await User.findById(req.user.id);
  user.tokenVersion += 1;
  await user.save();

  res.status(200).json({
    success: true,
    data: {}
  });
});

// Helper function to get token from model, create cookie and send response
const sendTokenResponse = (user, statusCode, res) => {
  // Create token
  const token = user.getSignedJwtToken();

  res.status(statusCode).json({
    success: true,
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      username: user.username
    }
  });
}; 