const mongoose = require('mongoose');

const participantSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  email: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected'],
    default: 'pending'
  },
  responseAt: {
    type: Date
  }
});

const meetingSchema = new mongoose.Schema({
  hostId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: [true, 'Please provide a meeting title'],
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  date: {
    type: String,
    required: [true, 'Please provide a meeting date']
  },
  startTime: {
    type: String,
    required: [true, 'Please provide a start time']
  },
  endTime: {
    type: String,
    required: [true, 'Please provide an end time']
  },
  duration: {
    type: Number, // In minutes
    required: [true, 'Please provide meeting duration']
  },
  timezone: {
    type: String,
    default: 'Asia/Kolkata' // Default to Indian Standard Time
  },
  meetingLink: {
    type: String
  },
  password: {
    type: String
  },
  status: {
    type: String,
    enum: ['upcoming', 'pending', 'cancelled', 'past'],
    default: 'upcoming'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  bannerSettings: {
    backgroundColor: {
      type: String,
      default: '#3498db'
    }
  },
  participants: [participantSchema],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt timestamp before save
meetingSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Method to check if meeting is past
meetingSchema.methods.isPast = function() {
  const meetingEndTime = new Date(`${this.date} ${this.endTime}`);
  return meetingEndTime < new Date();
};

// Method to update meeting status based on time
meetingSchema.methods.updateStatus = function() {
  if (this.isPast()) {
    this.status = 'past';
  }
};

module.exports = mongoose.model('Meeting', meetingSchema); 