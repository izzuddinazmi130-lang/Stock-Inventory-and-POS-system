const path = require('path');

// Where uploaded files (damage report photos) are kept. By default backend/uploads. On a host that replaces the
// app's folder every time it deploys, set UPLOAD_DIR in .env to a folder outside the app so photos are not lost.
const UPLOAD_ROOT = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(__dirname, '../../uploads');

module.exports = { UPLOAD_ROOT };