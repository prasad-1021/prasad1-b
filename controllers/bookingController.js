const Booking = require('../models/Booking');
const Meeting = require('../models/Meeting');
const MeetingInvitation = require('../models/MeetingInvitation');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');

// @desc    Get user's bookings dashboard
// @route   GET /api/bookings
// @access  Private
exports.getBookings = asyncHandler(async (req, res) => {
  let booking = await Booking.findOne({ userId: req.user.id });
  
  if (!booking) {
    // Create an empty booking dashboard
    booking = await Booking.create({
      userId: req.user.id,
      upcomingMeetings: [],
      pendingMeetings: [],
      canceledMeetings: [],
      pastMeetings: []
    });
  }
  
  res.status(200).json({
    success: true,
    data: booking
  });
});

// @desc    Get user's upcoming meetings (with search and pagination)
// @route   GET /api/bookings/upcoming
// @access  Private
exports.getUpcomingMeetings = asyncHandler(async (req, res) => {
  const booking = await Booking.findOne({ userId: req.user.id });
  
  if (!booking) {
    return res.status(404).json({
      success: false,
      message: 'Booking dashboard not found'
    });
  }
  
  // Apply search if provided
  let upcomingMeetings = booking.upcomingMeetings;
  
  if (req.query.search) {
    const searchRegex = new RegExp(req.query.search, 'i');
    upcomingMeetings = upcomingMeetings.filter(m => 
      searchRegex.test(m.title)
    );
  }
  
  // Apply pagination
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  const total = upcomingMeetings.length;
  
  const paginatedMeetings = upcomingMeetings.slice(startIndex, endIndex);
  
  // Pagination metadata
  const pagination = {};
  
  if (endIndex < total) {
    pagination.next = {
      page: page + 1,
      limit
    };
  }
  
  if (startIndex > 0) {
    pagination.prev = {
      page: page - 1,
      limit
    };
  }
  
  res.status(200).json({
    success: true,
    count: paginatedMeetings.length,
    pagination,
    data: paginatedMeetings
  });
});

// @desc    Get user's pending meetings (with search and pagination)
// @route   GET /api/bookings/pending
// @access  Private
exports.getPendingMeetings = asyncHandler(async (req, res) => {
  const booking = await Booking.findOne({ userId: req.user.id });
  
  if (!booking) {
    return res.status(404).json({
      success: false,
      message: 'Booking dashboard not found'
    });
  }
  
  // Apply search if provided
  let pendingMeetings = booking.pendingMeetings;
  
  if (req.query.search) {
    const searchRegex = new RegExp(req.query.search, 'i');
    pendingMeetings = pendingMeetings.filter(m => 
      searchRegex.test(m.title)
    );
  }
  
  // Apply pagination
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  const total = pendingMeetings.length;
  
  const paginatedMeetings = pendingMeetings.slice(startIndex, endIndex);
  
  // Pagination metadata
  const pagination = {};
  
  if (endIndex < total) {
    pagination.next = {
      page: page + 1,
      limit
    };
  }
  
  if (startIndex > 0) {
    pagination.prev = {
      page: page - 1,
      limit
    };
  }
  
  res.status(200).json({
    success: true,
    count: paginatedMeetings.length,
    pagination,
    data: paginatedMeetings
  });
});

// @desc    Get user's canceled meetings (with search and pagination)
// @route   GET /api/bookings/canceled
// @access  Private
exports.getCanceledMeetings = asyncHandler(async (req, res) => {
  const booking = await Booking.findOne({ userId: req.user.id });
  
  if (!booking) {
    return res.status(404).json({
      success: false,
      message: 'Booking dashboard not found'
    });
  }
  
  // Apply search if provided
  let canceledMeetings = booking.canceledMeetings;
  
  if (req.query.search) {
    const searchRegex = new RegExp(req.query.search, 'i');
    canceledMeetings = canceledMeetings.filter(m => 
      searchRegex.test(m.title)
    );
  }
  
  // Apply pagination
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  const total = canceledMeetings.length;
  
  const paginatedMeetings = canceledMeetings.slice(startIndex, endIndex);
  
  // Pagination metadata
  const pagination = {};
  
  if (endIndex < total) {
    pagination.next = {
      page: page + 1,
      limit
    };
  }
  
  if (startIndex > 0) {
    pagination.prev = {
      page: page - 1,
      limit
    };
  }
  
  res.status(200).json({
    success: true,
    count: paginatedMeetings.length,
    pagination,
    data: paginatedMeetings
  });
});

// @desc    Get user's past meetings (with search and pagination)
// @route   GET /api/bookings/past
// @access  Private
exports.getPastMeetings = asyncHandler(async (req, res) => {
  const booking = await Booking.findOne({ userId: req.user.id });
  
  if (!booking) {
    return res.status(404).json({
      success: false,
      message: 'Booking dashboard not found'
    });
  }
  
  // Apply search if provided
  let pastMeetings = booking.pastMeetings;
  
  if (req.query.search) {
    const searchRegex = new RegExp(req.query.search, 'i');
    pastMeetings = pastMeetings.filter(m => 
      searchRegex.test(m.title)
    );
  }
  
  // Apply pagination
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  const total = pastMeetings.length;
  
  const paginatedMeetings = pastMeetings.slice(startIndex, endIndex);
  
  // Pagination metadata
  const pagination = {};
  
  if (endIndex < total) {
    pagination.next = {
      page: page + 1,
      limit
    };
  }
  
  if (startIndex > 0) {
    pagination.prev = {
      page: page - 1,
      limit
    };
  }
  
  res.status(200).json({
    success: true,
    count: paginatedMeetings.length,
    pagination,
    data: paginatedMeetings
  });
});

// @desc    Get participants for a meeting
// @route   GET /api/bookings/meeting/:id/participants
// @access  Private
exports.getMeetingParticipants = asyncHandler(async (req, res) => {
  const meeting = await Meeting.findById(req.params.id);
  
  if (!meeting) {
    return res.status(404).json({
      success: false,
      message: 'Meeting not found'
    });
  }
  
  // Check if user is authorized to view participants
  const isHost = meeting.hostId.toString() === req.user.id;
  const isParticipant = meeting.participants.some(
    p => p.userId && p.userId.toString() === req.user.id
  );
  
  if (!isHost && !isParticipant) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to view participants'
    });
  }
  
  // Get all invitations for this meeting
  const invitations = await MeetingInvitation.find({ meetingId: meeting._id });
  
  // Compile participants information
  const participantsInfo = meeting.participants.map(p => ({
    userId: p.userId,
    email: p.email,
    status: p.status
  }));
  
  // Add pending invitations
  invitations.forEach(invitation => {
    // Check if already in participants list
    const exists = participantsInfo.some(p => p.email === invitation.email);
    
    if (!exists && invitation.status === 'pending') {
      participantsInfo.push({
        userId: invitation.userId,
        email: invitation.email,
        status: 'pending'
      });
    }
  });
  
  res.status(200).json({
    success: true,
    count: participantsInfo.length,
    data: participantsInfo
  });
});

// @desc    Update user bookings (refresh dashboard)
// @route   PUT /api/bookings/refresh
// @access  Private
exports.refreshBookings = asyncHandler(async (req, res) => {
  // Get all meetings where user is a participant
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
  
  console.log(`Refreshing bookings for user ${req.user.id}. Current time: ${now.toISOString()}`);
  
  // Get all meetings involving the user
  const allMeetings = await Meeting.find({
    $or: [
      { hostId: req.user.id },
      { 'participants.userId': req.user.id }
    ]
  });
  
  console.log(`Found ${allMeetings.length} meetings for user ${req.user.id}`);
  
  // Get all pending invitations for the user
  const pendingInvitations = await MeetingInvitation.find({
    $or: [
      { userId: req.user.id },
      { email: req.user.email }
    ],
    status: 'pending'
  }).populate('meetingId');
  
  // Initialize booking categories
  const upcomingMeetings = [];
  const pendingMeetings = [];
  const canceledMeetings = [];
  const pastMeetings = [];
  
  // Process all meetings
  for (const meeting of allMeetings) {
    // Find the participant entry for this user
    const participantEntry = meeting.participants.find(
      p => p.userId && p.userId.toString() === req.user.id
    );
    
    // Skip if user is not a participant
    if (!participantEntry && meeting.hostId.toString() !== req.user.id) {
      console.log(`No participant record found for user ${req.user.id} in meeting ${meeting._id}`);
      continue;
    }
    
    // Determine if meeting is in the past
    // Create a proper date object for comparison
    const [year, month, day] = meeting.date.split('-').map(Number);
    const [hours, minutes] = meeting.endTime.split(':').map(Number);
    
    // Create a proper date object for the meeting end time (months are 0-indexed in JS Date)
    const endDateTime = new Date(year, month - 1, day, hours, minutes);
    const isPast = endDateTime < now;
    
    console.log(`Meeting ${meeting._id}: ${meeting.title} - Date: ${meeting.date}, End Time: ${meeting.endTime}, isPast: ${isPast}`);
    
    // Create the meeting item
    const meetingItem = {
      meetingId: meeting._id,
      title: meeting.title,
      date: meeting.date,
      startTime: meeting.startTime,
      endTime: meeting.endTime,
      status: participantEntry ? participantEntry.status : 'accepted', // Host is always accepted
      hostId: meeting.hostId,
      isActive: meeting.isActive
    };
    
    // Add to appropriate category
    if (isPast) {
      console.log(`Adding meeting ${meeting._id} to past meetings`);
      pastMeetings.push(meetingItem);
    } else if (meeting.status === 'canceled') {
      console.log(`Adding meeting ${meeting._id} to canceled meetings`);
      canceledMeetings.push(meetingItem);
    } else if (participantEntry && participantEntry.status === 'accepted' || meeting.hostId.toString() === req.user.id) {
      console.log(`Adding meeting ${meeting._id} to upcoming meetings`);
      upcomingMeetings.push(meetingItem);
    }
  }
  
  // Process pending invitations
  for (const invitation of pendingInvitations) {
    const meeting = invitation.meetingId;
    
    if (meeting) {
      // Create a proper date object for comparison
      const [year, month, day] = meeting.date.split('-').map(Number);
      const [hours, minutes] = meeting.endTime.split(':').map(Number);
      
      // Create a proper date object for the meeting end time
      const endDateTime = new Date(year, month - 1, day, hours, minutes);
      const isPast = endDateTime < now;
      
      if (!isPast) {
        console.log(`Adding pending invitation for meeting ${meeting._id}`);
        pendingMeetings.push({
          meetingId: meeting._id,
          title: meeting.title,
          date: meeting.date,
          startTime: meeting.startTime,
          endTime: meeting.endTime,
          status: 'pending',
          hostId: meeting.hostId,
          isActive: meeting.isActive,
          invitationId: invitation._id
        });
      } else {
        console.log(`Skipping past pending invitation for meeting ${meeting._id}`);
      }
    }
  }
  
  // Find or create the user's booking dashboard
  let booking = await Booking.findOne({ userId: req.user.id });
  
  if (!booking) {
    booking = new Booking({
      userId: req.user.id,
      upcomingMeetings: [],
      pendingMeetings: [],
      canceledMeetings: [],
      pastMeetings: []
    });
  }
  
  // Update booking collections
  booking.upcomingMeetings = upcomingMeetings;
  booking.pendingMeetings = pendingMeetings;
  booking.canceledMeetings = canceledMeetings;
  booking.pastMeetings = pastMeetings;
  
  console.log(`Updated bookings for user ${req.user.id}: Upcoming=${upcomingMeetings.length}, Pending=${pendingMeetings.length}, Canceled=${canceledMeetings.length}, Past=${pastMeetings.length}`);
  
  await booking.save();
  
  res.status(200).json({
    success: true,
    data: booking
  });
}); 