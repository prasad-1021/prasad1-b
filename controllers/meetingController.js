const Meeting = require('../models/Meeting');
const User = require('../models/User');
const MeetingInvitation = require('../models/MeetingInvitation');
const Booking = require('../models/Booking');
const asyncHandler = require('../utils/asyncHandler');

// @desc    Create new meeting
// @route   POST /api/meetings
// @access  Private
exports.createMeeting = asyncHandler(async (req, res) => {
  // Add user ID to request body
  req.body.hostId = req.user.id;

  // Create meeting
  const meeting = await Meeting.create(req.body);

  // Process participants/invitees
  if (req.body.invitees && req.body.invitees.length > 0) {
    const invitationPromises = req.body.invitees.map(async (email) => {
      // Check if user exists with that email
      const invitedUser = await User.findOne({ email });
      
      const invitation = {
        meetingId: meeting._id,
        email: email.toLowerCase(),
        status: 'pending'
      };
      
      // If user exists, add their ID
      if (invitedUser) {
        invitation.userId = invitedUser._id;
        
        // Check for time conflicts
        const conflict = await checkTimeConflict(
          invitedUser._id, 
          req.body.date, 
          req.body.startTime, 
          req.body.endTime
        );
        
        if (conflict) {
          return {
            email,
            status: 'conflict detected'
          };
        }
      }
      
      // Create invitation
      await MeetingInvitation.create(invitation);
      
      // Also add to meeting's participants array as pending
      meeting.participants.push({
        userId: invitedUser ? invitedUser._id : null,
        email: email.toLowerCase(),
        status: 'pending'
      });
      
      // If the invited user exists, update their bookings to show the pending invitation
      if (invitedUser) {
        await updateUserBookings(invitedUser._id);
      }
      
      return {
        email,
        status: 'invitation sent'
      };
    });
    
    const invitationResults = await Promise.all(invitationPromises);
    
    // Update meeting with host as participant (auto-accepted)
    meeting.participants.push({
      userId: req.user.id,
      email: req.user.email,
      status: 'accepted'
    });
    
    await meeting.save();
    
    // Update host's booking/dashboard
    await updateUserBookings(req.user.id);
    
    res.status(201).json({
      success: true,
      data: meeting,
      invitations: invitationResults
    });
  } else {
    // Add host as the only participant (auto-accepted)
    meeting.participants.push({
      userId: req.user.id,
      email: req.user.email,
      status: 'accepted'
    });
    
    await meeting.save();
    
    // Update host's booking/dashboard
    await updateUserBookings(req.user.id);
    
    res.status(201).json({
      success: true,
      data: meeting
    });
  }
});

// @desc    Get all meetings (with pagination and search)
// @route   GET /api/meetings
// @access  Private
exports.getMeetings = asyncHandler(async (req, res) => {
  let query;
  
  // Copy req.query
  const reqQuery = { ...req.query };
  
  // Fields to exclude
  const removeFields = ['select', 'sort', 'page', 'limit', 'search'];
  
  // Loop over removeFields and delete them from reqQuery
  removeFields.forEach(param => delete reqQuery[param]);
  
  // Find meetings where user is either host or participant
  const baseQuery = {
    $or: [
      { hostId: req.user.id },
      { 'participants.userId': req.user.id },
      { 'participants.email': req.user.email }
    ]
  };
  
  // Merge baseQuery with reqQuery
  const finalQuery = { ...baseQuery, ...reqQuery };
  
  // Create query string
  let queryStr = JSON.stringify(finalQuery);
  
  // Create operators ($gt, $gte, etc)
  queryStr = queryStr.replace(/\b(gt|gte|lt|lte|in)\b/g, match => `$${match}`);
  
  // Finding resource
  query = Meeting.find(JSON.parse(queryStr));
  
  // Search functionality
  if (req.query.search) {
    const searchRegex = new RegExp(req.query.search, 'i');
    query = query.or([
      { title: searchRegex },
      { description: searchRegex }
    ]);
  }
  
  // Select fields
  if (req.query.select) {
    const fields = req.query.select.split(',').join(' ');
    query = query.select(fields);
  }
  
  // Sort
  if (req.query.sort) {
    const sortBy = req.query.sort.split(',').join(' ');
    query = query.sort(sortBy);
  } else {
    query = query.sort('-createdAt');
  }
  
  // Pagination
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  const total = await Meeting.countDocuments(JSON.parse(queryStr));
  
  query = query.skip(startIndex).limit(limit);
  
  // Execute query
  const meetings = await query;
  
  // Find all invitation IDs for this user's meetings
  const userEmail = req.user.email;
  const invitations = await MeetingInvitation.find({
    $or: [
      { userId: req.user.id },
      { email: userEmail }
    ]
  });

  // Create a lookup map for invitations by meetingId
  const invitationMap = {};
  invitations.forEach(inv => {
    invitationMap[inv.meetingId.toString()] = inv._id;
  });
  
  // Process meetings to add statusFor property - important to determine the status for this specific user
  const processedMeetings = meetings.map(meeting => {
    const meetingObj = meeting.toObject();
    
    // Check if user is the host
    const isHost = meetingObj.hostId.toString() === req.user.id;
    
    // Find user's participant entry
    const participantEntry = meetingObj.participants.find(p => 
      (p.userId && p.userId.toString() === req.user.id) || 
      p.email === req.user.email
    );
    
    // Set status specifically for the current user
    meetingObj.statusForUser = participantEntry ? participantEntry.status : null;
    
    // If user is host, never show meeting as pending
    if (isHost && meetingObj.statusForUser === 'pending') {
      meetingObj.statusForUser = 'accepted';
    }

    // Add invitation ID if available
    const meetingId = meetingObj._id.toString();
    if (invitationMap[meetingId]) {
      meetingObj.invitationId = invitationMap[meetingId].toString();
    }
    
    return meetingObj;
  });
  
  // Pagination result
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
    count: processedMeetings.length,
    pagination,
    data: processedMeetings
  });
});

// @desc    Get single meeting
// @route   GET /api/meetings/:id
// @access  Private
exports.getMeeting = asyncHandler(async (req, res) => {
  const meeting = await Meeting.findById(req.params.id);
  
  if (!meeting) {
    return res.status(404).json({
      success: false,
      message: 'Meeting not found'
    });
  }
  
  // Check if user is host or participant
  const isHost = meeting.hostId.toString() === req.user.id;
  const isParticipant = meeting.participants.some(
    participant => participant.userId && participant.userId.toString() === req.user.id
  );
  
  if (!isHost && !isParticipant) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to access this meeting'
    });
  }
  
  res.status(200).json({
    success: true,
    data: meeting
  });
});

// @desc    Update meeting
// @route   PUT /api/meetings/:id
// @access  Private
exports.updateMeeting = asyncHandler(async (req, res) => {
  let meeting = await Meeting.findById(req.params.id);
  
  if (!meeting) {
    return res.status(404).json({
      success: false,
      message: 'Meeting not found'
    });
  }
  
  // Make sure user is the host
  if (meeting.hostId.toString() !== req.user.id) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to update this meeting'
    });
  }
  
  // Check if the date/time has changed, if so, check for conflicts for participants
  if (
    req.body.date && req.body.date !== meeting.date ||
    req.body.startTime && req.body.startTime !== meeting.startTime ||
    req.body.endTime && req.body.endTime !== meeting.endTime
  ) {
    const conflicts = [];
    
    // Check for conflicts for all accepted participants
    for (const participant of meeting.participants) {
      if (participant.status === 'accepted' && participant.userId) {
        const conflict = await checkTimeConflict(
          participant.userId,
          req.body.date || meeting.date,
          req.body.startTime || meeting.startTime,
          req.body.endTime || meeting.endTime,
          meeting._id // Exclude current meeting from conflict check
        );
        
        if (conflict) {
          conflicts.push({
            userId: participant.userId,
            email: participant.email
          });
        }
      }
    }
    
    if (conflicts.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Time conflicts detected with some participants',
        conflicts
      });
    }
  }
  
  // Update the meeting
  meeting = await Meeting.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });
  
  // Update bookings for all participants
  for (const participant of meeting.participants) {
    if (participant.userId) {
      await updateUserBookings(participant.userId);
    }
  }
  
  res.status(200).json({
    success: true,
    data: meeting
  });
});

// @desc    Delete meeting
// @route   DELETE /api/meetings/:id
// @access  Private
exports.deleteMeeting = asyncHandler(async (req, res) => {
  const meeting = await Meeting.findById(req.params.id);
  
  if (!meeting) {
    return res.status(404).json({
      success: false,
      message: 'Meeting not found'
    });
  }
  
  // Make sure user is the host
  if (meeting.hostId.toString() !== req.user.id) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to delete this meeting'
    });
  }
  
  // Get all participants to update their bookings
  const participantIds = meeting.participants
    .filter(p => p.userId)
    .map(p => p.userId);
  
  // Delete all invitations for this meeting
  await MeetingInvitation.deleteMany({ meetingId: meeting._id });
  
  // Delete the meeting
  await meeting.deleteOne();
  
  // Update bookings for all participants
  for (const userId of participantIds) {
    await updateUserBookings(userId);
  }
  
  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    Toggle meeting active status
// @route   PUT /api/meetings/:id/active
// @access  Private
exports.toggleMeetingActive = asyncHandler(async (req, res) => {
  let meeting = await Meeting.findById(req.params.id);
  
  if (!meeting) {
    return res.status(404).json({
      success: false,
      message: 'Meeting not found'
    });
  }
  
  // Make sure user is the host
  if (meeting.hostId.toString() !== req.user.id) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to update this meeting'
    });
  }
  
  // Toggle the isActive status or set to the provided value
  meeting.isActive = req.body.isActive !== undefined ? req.body.isActive : !meeting.isActive;
  
  await meeting.save();
  
  res.status(200).json({
    success: true,
    data: meeting,
    message: `Meeting is now ${meeting.isActive ? 'active' : 'inactive'}`
  });
});

// Helper: Check for time conflicts for a user
async function checkTimeConflict(userId, date, startTime, endTime, excludeMeetingId = null) {
  // Check if userId is an email (contains @)
  const isEmail = typeof userId === 'string' && userId.includes('@');
  console.log(`Checking time conflicts for ${isEmail ? 'email' : 'userId'}: ${userId}`);
  
  // Find the user by ID or email to get their ID
  let userIdToCheck = userId;
  
  if (isEmail) {
    const user = await User.findOne({ email: userId });
    if (user) {
      userIdToCheck = user._id;
      console.log(`Found user by email: ${userId} -> ID: ${userIdToCheck}`);
    } else {
      console.log(`No user found with email: ${userId}`);
      return null; // No user with this email, so no conflicts
    }
  }
  
  // Get user's accepted meetings
  const query = {
    date: date,
    $or: [
      // Check if user is a participant with accepted status
      {
        'participants.userId': userIdToCheck,
        'participants.status': 'accepted'
      },
      // Check if user is the host
      { hostId: userIdToCheck }
    ]
  };
  
  if (excludeMeetingId) {
    query._id = { $ne: excludeMeetingId };
  }
  
  const userMeetings = await Meeting.find(query);
  console.log(`Found ${userMeetings.length} meetings for user on ${date}`);
  
  // Convert the time strings to Date objects for comparison
  const newStartTime = new Date(`${date}T${startTime}`);
  const newEndTime = new Date(`${date}T${endTime}`);
  
  console.log(`Checking conflicts between ${startTime} - ${endTime}`);
  
  // Check for overlaps
  for (const meeting of userMeetings) {
    const meetingStartTime = new Date(`${meeting.date}T${meeting.startTime}`);
    const meetingEndTime = new Date(`${meeting.date}T${meeting.endTime}`);
    
    console.log(`Comparing with meeting "${meeting.title}": ${meeting.startTime} - ${meeting.endTime}`);
    
    // Check if there's an overlap
    if (
      (newStartTime >= meetingStartTime && newStartTime < meetingEndTime) ||
      (newEndTime > meetingStartTime && newEndTime <= meetingEndTime) ||
      (newStartTime <= meetingStartTime && newEndTime >= meetingEndTime)
    ) {
      console.log(`Found conflict with meeting "${meeting.title}"`);
      return meeting; // Conflict found
    }
  }
  
  console.log(`No conflicts found for user ${userId} on ${date}`);
  return null; // No conflict
}

// Helper: Update user's booking dashboard
async function updateUserBookings(userId) {
  // Get all meetings where user is a participant
  const now = new Date();
  console.log(`Current time for comparison: ${now.toISOString()}`);
  
  // Get all meetings involving the user
  const allMeetings = await Meeting.find({
    $or: [
      { hostId: userId },
      { 'participants.userId': userId }
    ]
  });
  
  console.log(`Found ${allMeetings.length} meetings for user ${userId}`);
  
  // Get user information
  const user = await User.findById(userId);
  if (!user) {
    console.error(`User ${userId} not found for booking update`);
    return null;
  }
  
  // Initialize booking categories
  const upcomingMeetings = [];
  const pendingMeetings = [];
  const canceledMeetings = [];
  const pastMeetings = [];
  
  // Process each meeting
  for (const meeting of allMeetings) {
    // Parse date and time - ensure we're using the correct format
    try {
      const [year, month, day] = meeting.date.split('-').map(Number);
      
      // We should check based on the MEETING DATE, not just end time
      // For past meetings, even the date is important
      const meetingDate = new Date(year, month - 1, day);
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Set to beginning of today
      
      // Create date objects for proper comparison
      const [startHours, startMinutes] = meeting.startTime.split(':').map(Number);
      const [endHours, endMinutes] = meeting.endTime.split(':').map(Number);
      
      // Create complete date objects with time
      const startDateTime = new Date(year, month - 1, day, startHours, startMinutes);
      const endDateTime = new Date(year, month - 1, day, endHours, endMinutes);
      
      // A meeting is in the past if:
      // 1. The meeting date is before today, OR
      // 2. The meeting is today but the end time has passed
      const isPast = meetingDate < today || endDateTime < now;
      
      console.log(`Meeting ${meeting._id}: "${meeting.title}" - Date: ${meeting.date}, Start: ${meeting.startTime}, End: ${meeting.endTime}`);
      console.log(`  Meeting date: ${meetingDate.toISOString()}, Today: ${today.toISOString()}`);
      console.log(`  End time: ${endDateTime.toISOString()}, Now: ${now.toISOString()}`);
      console.log(`  isPast: ${isPast}`);
    
      // Find the participant record for this user
      const participantRecord = meeting.participants.find(
        p => (p.userId && p.userId.toString() === userId) || p.email === user.email
      );
      
      if (!participantRecord) {
        console.log(`  No participant record found for user ${userId}`);
        continue;
      }
      
      // Determine this user's relationship to the meeting
      const isHost = meeting.hostId.toString() === userId;
      const status = participantRecord.status;
      
      // Create base meeting data object
      const meetingData = {
        meetingId: meeting._id,
        title: meeting.title,
        date: meeting.date,
        startTime: meeting.startTime,
        endTime: meeting.endTime,
        status: status,
        hostId: meeting.hostId,
        isActive: meeting.isActive
      };
      
      // Categorize based on time and status
      if (isPast) {
        console.log(`  Adding meeting to PAST meetings`);
        pastMeetings.push(meetingData);
      } else if (meeting.status === 'cancelled' || status === 'rejected') {
        console.log(`  Adding meeting to CANCELED meetings`);
        canceledMeetings.push(meetingData);
      } else if (status === 'pending' && !isHost) {
        console.log(`  Adding meeting to PENDING meetings`);
        pendingMeetings.push(meetingData);
      } else if (status === 'accepted' || isHost) {
        console.log(`  Adding meeting to UPCOMING meetings`);
        upcomingMeetings.push(meetingData);
      }
    } catch (error) {
      console.error(`Error processing meeting ${meeting._id}: ${error.message}`);
      console.error(`Meeting data: ${JSON.stringify(meeting)}`);
    }
  }
  
  // Find or create the user's booking dashboard
  let booking = await Booking.findOne({ userId });
  
  if (!booking) {
    booking = new Booking({
      userId,
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
  
  console.log(`Updated bookings for user ${userId}:`);
  console.log(`  Upcoming: ${upcomingMeetings.length}`);
  console.log(`  Pending: ${pendingMeetings.length}`);
  console.log(`  Canceled: ${canceledMeetings.length}`);
  console.log(`  Past: ${pastMeetings.length}`);
  
  await booking.save();
  
  return booking;
}

// Helper: Ensure invitation exists for a user in a meeting
async function ensureInvitationExists(meetingId, userId, userEmail) {
  // Check if invitation already exists
  let invitation = await MeetingInvitation.findOne({
    meetingId,
    $or: [
      { userId },
      { email: userEmail }
    ]
  });
  
  // If invitation exists, return it
  if (invitation) {
    return invitation;
  }
  
  // Otherwise, create a new invitation
  console.log(`Creating new invitation for meeting ${meetingId} and user ${userId} (${userEmail})`);
  invitation = await MeetingInvitation.create({
    meetingId,
    userId,
    email: userEmail,
    status: 'pending'
  });
  
  return invitation;
}

// @desc    Accept or reject meeting invitation
// @route   PUT /api/meetings/invitation/:invitationId
// @access  Private
exports.respondToInvitation = asyncHandler(async (req, res) => {
  const { status } = req.body;
  
  if (!status || !['accepted', 'rejected'].includes(status)) {
    return res.status(400).json({
      success: false,
      message: 'Please provide a valid status (accepted or rejected)'
    });
  }
  
  let invitation;
  let isNewInvitation = false;

  try {
    // First try to find invitation by ID
    invitation = await MeetingInvitation.findById(req.params.invitationId);
    
    // If not found, it might be a meeting ID, so try to find or create invitation
    if (!invitation) {
      console.log(`Invitation not found with ID ${req.params.invitationId}. Checking if this is a meeting ID...`);
      
      // Check if a meeting exists with this ID
      const meeting = await Meeting.findById(req.params.invitationId);
      
      if (meeting) {
        console.log(`Found meeting with ID ${req.params.invitationId}. Creating invitation...`);
        invitation = await ensureInvitationExists(
          meeting._id,
          req.user.id,
          req.user.email
        );
        isNewInvitation = true;
      } else {
        return res.status(404).json({
          success: false,
          message: 'Neither invitation nor meeting found with this ID'
        });
      }
    }
  } catch (error) {
    console.error(`Error finding invitation: ${error.message}`);
    return res.status(404).json({
      success: false,
      message: 'Invitation not found'
    });
  }
  
  // Make sure invitation belongs to the user
  if (
    (invitation.userId && invitation.userId.toString() !== req.user.id) &&
    invitation.email !== req.user.email
  ) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to respond to this invitation'
    });
  }
  
  // Update invitation status
  invitation.status = status;
  await invitation.save();
  
  // Find the meeting
  const meeting = await Meeting.findById(invitation.meetingId);
  
  if (!meeting) {
    return res.status(404).json({
      success: false,
      message: 'Meeting not found'
    });
  }
  
  // Find the participant entry for this user
  const participantIndex = meeting.participants.findIndex(
    p => (p.userId && p.userId.toString() === req.user.id) || p.email === invitation.email
  );
  
  if (status === 'accepted') {
    // If user already exists in participants, update status
    if (participantIndex !== -1) {
      meeting.participants[participantIndex].status = 'accepted';
      meeting.participants[participantIndex].responseAt = new Date();
      
      // Ensure user ID is set if it wasn't before
      if (!meeting.participants[participantIndex].userId && req.user.id) {
        meeting.participants[participantIndex].userId = req.user.id;
      }
    } else {
      // Add user to participants
      meeting.participants.push({
        userId: req.user.id,
        email: invitation.email,
        status: 'accepted',
        responseAt: new Date()
      });
    }
  } else if (status === 'rejected') {
    // If found in participants array, update status to rejected
    if (participantIndex !== -1) {
      meeting.participants[participantIndex].status = 'rejected';
      meeting.participants[participantIndex].responseAt = new Date();
    }
  }
  
  await meeting.save();
  
  // Update user's bookings
  console.log(`Updating bookings for user ${req.user.id} after responding to invitation`);
  await updateUserBookings(req.user.id);
  
  // Also update host's bookings to reflect the status change
  if (meeting.hostId.toString() !== req.user.id) {
    console.log(`Updating bookings for host ${meeting.hostId} after user response`);
    await updateUserBookings(meeting.hostId);
  }
  
  res.status(200).json({
    success: true,
    data: invitation,
    meeting
  });
});

// @desc    Duplicate a meeting
// @route   POST /api/meetings/:id/duplicate
// @access  Private
exports.duplicateMeeting = asyncHandler(async (req, res) => {
  const meeting = await Meeting.findById(req.params.id);
  
  if (!meeting) {
    return res.status(404).json({
      success: false,
      message: 'Meeting not found'
    });
  }
  
  // Make sure user is the host
  if (meeting.hostId.toString() !== req.user.id) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to duplicate this meeting'
    });
  }
  
  // Create new meeting object based on existing one
  const newMeetingData = {
    hostId: meeting.hostId,
    title: `${meeting.title} (Copy)`,
    description: meeting.description,
    date: meeting.date,
    startTime: meeting.startTime,
    endTime: meeting.endTime,
    duration: meeting.duration,
    timezone: meeting.timezone,
    meetingLink: meeting.meetingLink,
    bannerSettings: meeting.bannerSettings,
    isActive: true, // Set the copy to active by default
    // Don't copy participants or status - it's a new meeting
  };
  
  // Optional: Allow customizing the duplicate through request body
  if (req.body.title) {
    newMeetingData.title = req.body.title;
  }
  
  if (req.body.date) {
    newMeetingData.date = req.body.date;
  }
  
  // Create the new meeting
  const newMeeting = await Meeting.create(newMeetingData);
  
  // Add the host as a participant
  newMeeting.participants.push({
    userId: req.user.id,
    email: req.user.email,
    status: 'accepted'
  });
  
  await newMeeting.save();
  
  res.status(201).json({
    success: true,
    data: newMeeting,
    message: 'Meeting duplicated successfully'
  });
});

// @desc    Toggle meeting status (scheduled, canceled, completed)
// @route   PUT /api/meetings/:id/toggle
// @access  Private
exports.toggleMeetingStatus = asyncHandler(async (req, res) => {
  const meeting = await Meeting.findById(req.params.id);
  
  if (!meeting) {
    return res.status(404).json({
      success: false,
      message: 'Meeting not found'
    });
  }
  
  // Make sure user is the host
  if (meeting.hostId.toString() !== req.user.id) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to update this meeting'
    });
  }
  
  // Set the new status or cycle through statuses
  if (req.body.status && ['scheduled', 'canceled', 'completed'].includes(req.body.status)) {
    meeting.status = req.body.status;
  } else {
    // Cycle through statuses: scheduled -> completed -> canceled -> scheduled
    if (meeting.status === 'scheduled') {
      meeting.status = 'completed';
    } else if (meeting.status === 'completed') {
      meeting.status = 'canceled';
    } else {
      meeting.status = 'scheduled';
    }
  }
  
  await meeting.save();
  
  // Update bookings for all participants
  for (const participant of meeting.participants) {
    if (participant.userId) {
      await updateUserBookings(participant.userId);
    }
  }
  
  res.status(200).json({
    success: true,
    data: meeting,
    message: `Meeting status updated to ${meeting.status}`
  });
});

// @route   GET /api/meetings/created
// @access  Private
exports.getUserCreatedMeetings = asyncHandler(async (req, res) => {
  console.log('getUserCreatedMeetings called');
  console.log('User ID:', req.user.id);
  let query;
  
  // Copy req.query
  const reqQuery = { ...req.query };
  
  // Fields to exclude
  const removeFields = ['select', 'sort', 'page', 'limit', 'search'];
  
  // Loop over removeFields and delete them from reqQuery
  removeFields.forEach(param => delete reqQuery[param]);
  
  // Find meetings where user is the host/creator
  const baseQuery = {
    hostId: req.user.id
  };
  console.log('Base query:', baseQuery);
  
  // Merge baseQuery with reqQuery
  const finalQuery = { ...baseQuery, ...reqQuery };
  console.log('Final query:', finalQuery);
  
  // Create query string
  let queryStr = JSON.stringify(finalQuery);
  
  // Create operators ($gt, $gte, etc)
  queryStr = queryStr.replace(/\b(gt|gte|lt|lte|in)\b/g, match => `$${match}`);
  
  // Finding resource
  query = Meeting.find(JSON.parse(queryStr));
  
  // Search functionality
  if (req.query.search) {
    const searchRegex = new RegExp(req.query.search, 'i');
    query = query.or([
      { title: searchRegex },
      { description: searchRegex }
    ]);
  }
  
  // Select fields
  if (req.query.select) {
    const fields = req.query.select.split(',').join(' ');
    query = query.select(fields);
  }
  
  // Sort
  if (req.query.sort) {
    const sortBy = req.query.sort.split(',').join(' ');
    query = query.sort(sortBy);
  } else {
    query = query.sort('-createdAt');
  }
  
  // Pagination
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  const total = await Meeting.countDocuments(JSON.parse(queryStr));
  
  query = query.skip(startIndex).limit(limit);
  
  // Execute query
  const meetings = await query;
  console.log('Found meetings:', meetings.length);
  console.log('Meeting IDs:', meetings.map(m => m._id.toString()));
  
  // Pagination result
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
    count: meetings.length,
    pagination,
    data: meetings
  });
});

// @desc    Check if a meeting conflicts with user's availability
// @route   POST /api/meetings/check-availability
// @access  Private
exports.checkUserAvailability = asyncHandler(async (req, res) => {
  const { date, startTime, endTime, userId } = req.body;
  
  // Validate required fields
  if (!date || !startTime || !endTime) {
    return res.status(400).json({
      success: false,
      message: 'Please provide date, startTime, and endTime'
    });
  }
  
  let targetUser;
  
  // Check if we're looking up another user by their email or ID
  if (userId && userId !== req.user.id) {
    console.log(`Checking availability for user with email/id: ${userId}`);
    
    // First try to find user by email (since the frontend passes email in the userId field)
    targetUser = await User.findOne({ email: userId });
    
    // If not found by email, try by ID
    if (!targetUser) {
      targetUser = await User.findById(userId);
    }
    
    // If user still not found
    if (!targetUser) {
      return res.status(200).json({
        success: true,
        available: true, // Default to available if user not found
        message: `User with email/id ${userId} not found - assuming available`
      });
    }
    
    console.log(`Found user: ${targetUser.name} (${targetUser._id})`);
  } else {
    // Use the authenticated user
    targetUser = await User.findById(req.user.id);
    
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
  }
  
  // Get the day of the week for the requested date
  const dayOfWeek = new Date(date).toLocaleString('en-US', { weekday: 'long' });
  
  // Find the day in the user's availability
  const availabilityForDay = targetUser.availability.find(a => a.day === dayOfWeek);
  
  // If no availability is set for this day or the day is marked as unavailable
  if (!availabilityForDay || !availabilityForDay.isAvailable) {
    return res.status(200).json({
      success: true,
      available: false,
      message: `${targetUser._id.toString() === req.user.id.toString() ? "You're" : `${targetUser.name || 'User'} is`} not available on ${dayOfWeek}s`
    });
  }
  
  // Check if the time fits within any available slot
  let isTimeAvailable = false;
  let availableSlotMessage = '';
  
  // Parse meeting start and end times for comparison (convert to minutes)
  const meetingStartMinutes = parseTimeToMinutes(startTime);
  const meetingEndMinutes = parseTimeToMinutes(endTime);
  
  if (availabilityForDay.slots && availabilityForDay.slots.length > 0) {
    // Check each slot
    for (const slot of availabilityForDay.slots) {
      // Skip slots with empty times (unspecified)
      if (!slot.startTime || !slot.endTime) {
        continue;
      }
      
      // Parse slot times
      const slotStartMinutes = parseTimeToMinutes(slot.startTime);
      const slotEndMinutes = parseTimeToMinutes(slot.endTime);
      
      // Compare times
      if (meetingStartMinutes >= slotStartMinutes && meetingEndMinutes <= slotEndMinutes) {
        isTimeAvailable = true;
        availableSlotMessage = `Time is available within slot ${slot.startTime} - ${slot.endTime}`;
        break;
      }
    }
  } else {
    // If no specific slots are defined but the day is available, consider all day available
    isTimeAvailable = true;
    availableSlotMessage = 'All day is available';
  }
  
  // Check for conflicts with existing accepted meetings
  let meetingConflict = null;
  if (isTimeAvailable) {
    meetingConflict = await checkTimeConflict(targetUser._id, date, startTime, endTime);
  }
  
  // Include the name of the user being checked in the response message
  const userReference = targetUser._id.toString() === req.user.id.toString() 
    ? 'You have' 
    : `${targetUser.name || 'User'} has`;
  
  res.status(200).json({
    success: true,
    available: isTimeAvailable && !meetingConflict,
    message: meetingConflict 
      ? `${userReference} a conflict with existing meeting "${meetingConflict.title}"` 
      : (isTimeAvailable 
          ? availableSlotMessage 
          : `${userReference} no available time slot on ${dayOfWeek} for this meeting`),
    conflict: meetingConflict ? {
      meetingId: meetingConflict._id,
      title: meetingConflict.title,
      time: `${meetingConflict.startTime} - ${meetingConflict.endTime}`
    } : null
  });
});

// Helper function to parse time strings to minutes for easier comparison
function parseTimeToMinutes(timeStr) {
  // Handle different time formats
  if (!timeStr) return 0;
  
  // Format: "HH:MM" (24-hour format)
  if (timeStr.includes(':')) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  }
  
  // Format: "HH:MM AM/PM" (12-hour format)
  if (timeStr.includes(' ')) {
    const [time, period] = timeStr.split(' ');
    let [hours, minutes] = time.split(':').map(Number);
    
    // Convert to 24-hour format
    if (period && period.toUpperCase() === 'PM' && hours < 12) {
      hours += 12;
    } else if (period && period.toUpperCase() === 'AM' && hours === 12) {
      hours = 0;
    }
    
    return hours * 60 + minutes;
  }
  
  // Default if none of the above matched
  return 0;
} 