const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Protect routes
exports.protect = async (req, res, next) => {
  let token;
  console.log('Auth middleware called');

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    // Set token from Bearer token in header
    token = req.headers.authorization.split(' ')[1];
    console.log('Token extracted from Authorization header');
  }

  // Check if token exists
  if (!token) {
    console.log('No token found in request');
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route'
    });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Token verified, decoded user ID:', decoded.id);

    // Add user from payload
    const user = await User.findById(decoded.id);

    if (!user) {
      console.log('User not found in database for ID:', decoded.id);
      return res.status(401).json({
        success: false,
        message: 'User no longer exists'
      });
    }

    // Check if token version matches
    if (decoded.version !== user.tokenVersion) {
      console.log('Token version mismatch. Token:', decoded.version, 'User:', user.tokenVersion);
      return res.status(401).json({
        success: false,
        message: 'Token is no longer valid, please login again'
      });
    }

    console.log('User authenticated successfully:', user._id.toString());
    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error.message);
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route'
    });
  }
}; 