const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');

// @desc    Get user's availability
// @route   GET /api/availability
// @access  Private
exports.getAvailability = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  res.status(200).json({
    success: true,
    data: user.availability
  });
});

// @desc    Update user's availability
// @route   PUT /api/availability
// @access  Private
exports.updateAvailability = asyncHandler(async (req, res) => {
  const { availability } = req.body;
  console.log(`Updating availability for user ID: ${req.user.id}`);
  console.log('Received availability data:', JSON.stringify(availability));

  if (!availability || !Array.isArray(availability)) {
    console.error('Invalid availability data received:', req.body);
    return res.status(400).json({
      success: false,
      message: 'Please provide valid availability data'
    });
  }

  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      console.error(`User not found with ID: ${req.user.id}`);
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    console.log('Previous availability:', JSON.stringify(user.availability));
    user.availability = availability;
    
    try {
      await user.save();
      console.log('Availability updated successfully for user:', req.user.id);
      
      res.status(200).json({
        success: true,
        data: user.availability
      });
    } catch (saveError) {
      console.error('Error saving user availability:', saveError);
      res.status(500).json({
        success: false,
        message: 'Error saving availability data',
        error: saveError.message
      });
    }
  } catch (error) {
    console.error('Error in updateAvailability:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating availability',
      error: error.message
    });
  }
});

// @desc    Update user's timezone preference
// @route   PUT /api/preferences/timezone
// @access  Private
exports.updateTimezone = asyncHandler(async (req, res) => {
  const { timezone } = req.body;

  if (!timezone) {
    return res.status(400).json({
      success: false,
      message: 'Please provide a valid timezone'
    });
  }

  const user = await User.findById(req.user.id);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  if (!user.preferences) {
    user.preferences = {};
  }

  user.preferences.timezone = timezone;
  await user.save();

  res.status(200).json({
    success: true,
    data: user.preferences
  });
});

// @desc    Get user's timezone preference
// @route   GET /api/preferences/timezone
// @access  Private
exports.getTimezone = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  const timezone = user.preferences?.timezone || 'Asia/Kolkata';

  res.status(200).json({
    success: true,
    data: { timezone }
  });
});

// @desc    Update availability for a specific day
// @route   PUT /api/availability/:day
// @access  Private
exports.updateDayAvailability = asyncHandler(async (req, res) => {
  const { day } = req.params;
  const { isAvailable, slots } = req.body;

  // Validate day
  const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  if (!validDays.includes(day)) {
    return res.status(400).json({
      success: false,
      message: 'Please provide a valid day'
    });
  }

  const user = await User.findById(req.user.id);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  // Process and validate slots
  let validatedSlots = [];
  if (isAvailable && slots && Array.isArray(slots)) {
    // Filter out invalid slots and ensure default values for empty fields
    validatedSlots = slots.filter(slot => slot && typeof slot === 'object')
                         .map(slot => ({
                            startTime: slot.startTime || '',
                            endTime: slot.endTime || ''
                         }));
    
    // If no valid slots but day is available, add a default empty slot
    if (validatedSlots.length === 0 && isAvailable) {
      validatedSlots = [{ startTime: '', endTime: '' }];
    }
  }

  // Find the day in the user's availability
  const dayIndex = user.availability.findIndex(a => a.day === day);

  if (dayIndex === -1) {
    // If the day doesn't exist, add it
    // Initialize with empty slots if the day is available
    user.availability.push({
      day,
      isAvailable: isAvailable !== undefined ? isAvailable : true,
      slots: isAvailable !== false ? validatedSlots : []
    });
  } else {
    // Update existing day
    if (isAvailable !== undefined) {
      user.availability[dayIndex].isAvailable = isAvailable;
      
      // If day is marked as unavailable, clear its slots
      if (!isAvailable) {
        user.availability[dayIndex].slots = [];
      } else if (validatedSlots.length > 0) {
        // If slots were provided and valid, update them
        user.availability[dayIndex].slots = validatedSlots;
      } else if (user.availability[dayIndex].slots.length === 0) {
        // If no slots exist but day is marked available, add default empty slot
        user.availability[dayIndex].slots = [{ startTime: '', endTime: '' }];
      }
    } else if (isAvailable !== false && validatedSlots.length > 0) {
      // If day is already available and slots were provided, update them
      user.availability[dayIndex].slots = validatedSlots;
    }
  }

  try {
    await user.save();

    res.status(200).json({
      success: true,
      data: user.availability.find(a => a.day === day)
    });
  } catch (error) {
    console.error('Day availability update error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// @desc    Copy time slots from one day to other days
// @route   POST /api/availability/copy
// @access  Private
exports.copyTimeSlots = asyncHandler(async (req, res) => {
  const { sourceDay, targetDays } = req.body;

  // Validate days
  const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  
  if (!sourceDay || !validDays.includes(sourceDay)) {
    return res.status(400).json({
      success: false,
      message: 'Please provide a valid source day'
    });
  }

  if (!targetDays || !Array.isArray(targetDays) || targetDays.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Please provide at least one valid target day'
    });
  }

  for (const day of targetDays) {
    if (!validDays.includes(day)) {
      return res.status(400).json({
        success: false,
        message: `${day} is not a valid day`
      });
    }
  }

  const user = await User.findById(req.user.id);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  // Find the source day in the user's availability
  const sourceAvailability = user.availability.find(a => a.day === sourceDay);
  
  if (!sourceAvailability) {
    return res.status(404).json({
      success: false,
      message: `Source day ${sourceDay} not found in user's availability`
    });
  }

  // Copy slots from source day to target days
  for (const targetDay of targetDays) {
    if (targetDay === sourceDay) continue; // Skip if source and target are the same
    
    const targetIndex = user.availability.findIndex(a => a.day === targetDay);
    
    if (targetIndex === -1) {
      // If target day doesn't exist, add it
      user.availability.push({
        day: targetDay,
        isAvailable: true,
        slots: JSON.parse(JSON.stringify(sourceAvailability.slots)) // Deep copy
      });
    } else {
      // Update existing day if it's available
      if (user.availability[targetIndex].isAvailable) {
        user.availability[targetIndex].slots = 
          JSON.parse(JSON.stringify(sourceAvailability.slots)); // Deep copy
      }
    }
  }

  await user.save();

  res.status(200).json({
    success: true,
    data: user.availability
  });
});

// @desc    Update weekend days (Saturday and Sunday) availability
// @route   PUT /api/availability/weekend
// @access  Private
exports.updateWeekendAvailability = asyncHandler(async (req, res) => {
  const { saturday, sunday } = req.body;
  
  const user = await User.findById(req.user.id);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  // Update Saturday
  if (saturday) {
    const { isAvailable, slots } = saturday;
    const satIndex = user.availability.findIndex(a => a.day === 'Saturday');
    
    // Process and validate slots
    let validatedSlots = [];
    if (isAvailable && slots && Array.isArray(slots)) {
      // Filter out invalid slots and ensure default values for empty fields
      validatedSlots = slots.filter(slot => slot && typeof slot === 'object')
                           .map(slot => ({
                              startTime: slot.startTime || '',
                              endTime: slot.endTime || ''
                           }));
      
      // If no valid slots but day is available, add a default empty slot
      if (validatedSlots.length === 0 && isAvailable) {
        validatedSlots = [{ startTime: '', endTime: '' }];
      }
    }
    
    if (satIndex === -1) {
      // If Saturday doesn't exist in availability, add it
      user.availability.push({
        day: 'Saturday',
        isAvailable: isAvailable !== undefined ? isAvailable : false,
        slots: isAvailable ? validatedSlots : []
      });
    } else {
      // Update existing Saturday
      if (isAvailable !== undefined) {
        user.availability[satIndex].isAvailable = isAvailable;
        
        // If marked unavailable, clear slots
        if (!isAvailable) {
          user.availability[satIndex].slots = [];
        } else if (validatedSlots.length > 0) {
          // Only update slots if there are valid ones and day is available
          user.availability[satIndex].slots = validatedSlots;
        } else if (user.availability[satIndex].slots.length === 0) {
          // Add default empty slot if no slots exist
          user.availability[satIndex].slots = [{ startTime: '', endTime: '' }];
        }
      } else if (isAvailable && validatedSlots.length > 0) {
        // Update slots if provided and day is already marked available
        user.availability[satIndex].slots = validatedSlots;
      }
    }
  }

  // Update Sunday
  if (sunday) {
    const { isAvailable, slots } = sunday;
    const sunIndex = user.availability.findIndex(a => a.day === 'Sunday');
    
    // Process and validate slots
    let validatedSlots = [];
    if (isAvailable && slots && Array.isArray(slots)) {
      // Filter out invalid slots and ensure default values for empty fields
      validatedSlots = slots.filter(slot => slot && typeof slot === 'object')
                           .map(slot => ({
                              startTime: slot.startTime || '',
                              endTime: slot.endTime || ''
                           }));
      
      // If no valid slots but day is available, add a default empty slot
      if (validatedSlots.length === 0 && isAvailable) {
        validatedSlots = [{ startTime: '', endTime: '' }];
      }
    }
    
    if (sunIndex === -1) {
      // If Sunday doesn't exist in availability, add it
      user.availability.push({
        day: 'Sunday',
        isAvailable: isAvailable !== undefined ? isAvailable : false,
        slots: isAvailable ? validatedSlots : []
      });
    } else {
      // Update existing Sunday
      if (isAvailable !== undefined) {
        user.availability[sunIndex].isAvailable = isAvailable;
        
        // If marked unavailable, clear slots
        if (!isAvailable) {
          user.availability[sunIndex].slots = [];
        } else if (validatedSlots.length > 0) {
          // Only update slots if there are valid ones and day is available
          user.availability[sunIndex].slots = validatedSlots;
        } else if (user.availability[sunIndex].slots.length === 0) {
          // Add default empty slot if no slots exist
          user.availability[sunIndex].slots = [{ startTime: '', endTime: '' }];
        }
      } else if (isAvailable && validatedSlots.length > 0) {
        // Update slots if provided and day is already marked available
        user.availability[sunIndex].slots = validatedSlots;
      }
    }
  }

  try {
    await user.save();

    // Return the updated weekend days
    const updatedWeekend = {
      saturday: user.availability.find(a => a.day === 'Saturday'),
      sunday: user.availability.find(a => a.day === 'Sunday')
    };

    res.status(200).json({
      success: true,
      data: updatedWeekend
    });
  } catch (error) {
    console.error('Weekend availability update error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// @desc    Get user's preferences
// @route   GET /api/preferences
// @access  Private
exports.getPreferences = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  // Return user preferences or an empty object if none exists
  res.status(200).json({
    success: true,
    data: user.preferences || {}
  });
});

// @desc    Update user's event type preferences
// @route   PUT /api/preferences/eventType
// @access  Private
exports.updateEventType = asyncHandler(async (req, res) => {
  const { eventType } = req.body;

  if (!eventType) {
    return res.status(400).json({
      success: false,
      message: 'Please provide valid event type preferences'
    });
  }

  const user = await User.findById(req.user.id);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  // Initialize preferences if they don't exist
  if (!user.preferences) {
    user.preferences = {};
  }

  // Update event type preference
  user.preferences.eventType = eventType;
  await user.save();

  res.status(200).json({
    success: true,
    data: user.preferences
  });
});

// @desc    Get user's event type preferences
// @route   GET /api/preferences/eventType
// @access  Private
exports.getEventType = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  // Return event type preference or default value
  const eventType = user.preferences?.eventType || 'Meeting';
  
  res.status(200).json({
    success: true,
    data: { eventType }
  });
});

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
exports.updateProfile = asyncHandler(async (req, res) => {
  const { firstName, lastName, email } = req.body;
  
  console.log('Updating profile for user ID:', req.user.id);
  console.log('Request body:', req.body);
  
  // Create fields to update object
  const fieldsToUpdate = {};
  
  if (firstName || lastName) {
    // Prepare the full name from firstName and lastName
    // If only one is provided, use the existing one from the user record
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Extract existing first and last name
    const existingNames = user.name ? user.name.split(' ') : ['', ''];
    const existingFirstName = existingNames[0] || '';
    const existingLastName = existingNames.slice(1).join(' ') || '';
    
    // Use provided values or fall back to existing ones
    const newFirstName = firstName || existingFirstName;
    const newLastName = lastName || existingLastName;
    
    fieldsToUpdate.name = `${newFirstName} ${newLastName}`.trim();
    console.log('Name will be updated to:', fieldsToUpdate.name);
  }
  
  if (email) {
    fieldsToUpdate.email = email;
    console.log('Email will be updated to:', email);
  }
  
  if (Object.keys(fieldsToUpdate).length === 0) {
    return res.status(400).json({
      success: false,
      message: 'No valid fields to update'
    });
  }
  
  // Find user and update
  try {
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      fieldsToUpdate,
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      console.error('User not found after update attempt:', req.user.id);
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    console.log('User updated successfully:', updatedUser._id);
    
    // Create clean user object for response
    const nameParts = updatedUser.name ? updatedUser.name.split(' ') : ['', ''];
    const userData = {
      id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      username: updatedUser.username,
      firstName: nameParts[0] || '',
      lastName: nameParts.slice(1).join(' ') || ''
    };

    console.log('Sending updated user data:', userData);
    
    res.status(200).json({
      success: true,
      data: userData
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating profile',
      error: error.message
    });
  }
});

// @desc    Update user password
// @route   PUT /api/users/password
// @access  Private
exports.updatePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  
  console.log('Updating password for user ID:', req.user.id);
  
  // Validate input
  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      success: false,
      message: 'Please provide both current and new password'
    });
  }
  
  if (newPassword.length < 6) {
    return res.status(400).json({
      success: false,
      message: 'Password must be at least 6 characters long'
    });
  }
  
  try {
    // Get user with password
    const user = await User.findById(req.user.id).select('+password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Check if current password matches
    const isMatch = await user.matchPassword(currentPassword);
    
    if (!isMatch) {
      console.log('Current password does not match for user:', req.user.id);
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }
    
    // Update password
    user.password = newPassword;
    await user.save();
    
    console.log('Password updated successfully for user:', req.user.id);
    
    res.status(200).json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (error) {
    console.error('Error updating password:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating password',
      error: error.message
    });
  }
});

// @desc    Update user password without verification (for admin or password reset)
// @route   PUT /api/users/password/reset
// @access  Private
exports.updatePasswordNoVerification = asyncHandler(async (req, res) => {
  const { newPassword } = req.body;
  
  console.log('Updating password without verification for user ID:', req.user.id);
  
  // Validate input
  if (!newPassword) {
    return res.status(400).json({
      success: false,
      message: 'Please provide a new password'
    });
  }
  
  if (newPassword.length < 6) {
    return res.status(400).json({
      success: false,
      message: 'Password must be at least 6 characters long'
    });
  }
  
  try {
    // Get user
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Update password
    user.password = newPassword;
    await user.save();
    
    console.log('Password updated successfully for user:', req.user.id);
    
    res.status(200).json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (error) {
    console.error('Error updating password:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating password',
      error: error.message
    });
  }
}); 