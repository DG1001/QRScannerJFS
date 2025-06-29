
// Regex to capture the ID after '/checkin/'
// Example: https://doo.net/checkin/i53tyWRq or https://doo.net/checkin/guest-12345
// Captures the ID, which can contain letters, numbers, and hyphens.
// Handles optional trailing slash or query parameters.
export const ID_REGEX = /\/checkin\/([a-zA-Z0-9-]+)(?:[\/?#]|$)/;
