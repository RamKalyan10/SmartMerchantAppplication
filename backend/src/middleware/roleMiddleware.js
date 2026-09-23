const ROLE_HIERARCHY = {
  Owner: 4,
  Admin: 3,
  Manager: 2,
  Staff: 1
};

function requireRole(minimumRole) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const userLevel = ROLE_HIERARCHY[req.user.role] || 0;
    const requiredLevel = ROLE_HIERARCHY[minimumRole] || 1;

    if (userLevel < requiredLevel) {
      return res.status(403).json({
        message: `Forbidden: Requires '${minimumRole}' role or higher. Current role: '${req.user.role}'`
      });
    }

    next();
  };
}

module.exports = { requireRole };
