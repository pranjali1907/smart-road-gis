/**
 * Render Entry Point
 * This file redirects to the backend server to fix the "MODULE_NOT_FOUND" error.
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Execute the server
require('./server/index.js');
