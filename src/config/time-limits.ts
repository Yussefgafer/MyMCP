/**
 * Default time limit for operations in seconds
 * Can be overridden with TIME_LIMIT environment variable
 * Default: 120 seconds (2 minutes)
 */
export const DEFAULT_TIME_LIMIT = parseInt(process.env.TIME_LIMIT || '120');

/**
 * Maximum allowed time limit to prevent abuse
 * Can be overridden with MAX_TIME_LIMIT environment variable
 * Default: 600 seconds (10 minutes)
 */
export const MAX_TIME_LIMIT = parseInt(process.env.MAX_TIME_LIMIT || '600');
