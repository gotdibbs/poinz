/**
 *  UI-only
 */
export const TOGGLE_BACKLOG = 'TOGGLE_BACKLOG'; // toggles the visibility of the story backlog
export const TOGGLE_SIDEBAR = 'TOGGLE_SIDEBAR'; // toggles the visibility of the righthand sidebar (could be either settings, action log or help)
export const EDIT_STORY = 'EDIT_STORY';
export const HIGHLIGHT_STORY = 'HIGHLIGHT_STORY';
export const CANCEL_EDIT_STORY = 'CANCEL_EDIT_STORY';
export const SET_LANGUAGE = 'SET_LANGUAGE';
export const STATUS_FETCHED = 'STATUS_FETCHED';
export const ROOM_STATE_FETCHED = 'ROOM_STATE_FETCHED';
export const LOCATION_CHANGED = 'LOCATION_CHANGED';
export const HIDE_NEW_USER_HINTS = 'HIDE_NEW_USER_HINTS';
export const SHOW_TRASH = 'SHOW_TRASH';
export const HIDE_TRASH = 'HIDE_TRASH';
export const TOGGLE_MARK_FOR_KICK = 'TOGGLE_MARK_FOR_KICK';

/**
 * Action types for backend events
 */
export const EVENT_ACTION_TYPES = {
  roomCreated: 'ROOM_CREATED',
  joinedRoom: 'JOINED_ROOM',
  leftRoom: 'LEFT_ROOM',
  kicked: 'KICKED',
  connectionLost: 'CONNECTION_LOST',
  commandRejected: 'COMMAND_REJECTED',
  storyAdded: 'STORY_ADDED',
  storySelected: 'STORY_SELECTED',
  importFailed: 'IMPORT_FAILED',
  usernameSet: 'USERNAME_SET',
  emailSet: 'EMAIL_SET',
  avatarSet: 'AVATAR_SET',
  storyEstimateGiven: 'STORY_ESTIMATE_GIVEN',
  consensusAchieved: 'CONSENSUS_ACHIEVED',
  storyEstimateCleared: 'STORY_ESTIMATE_CLEARED',
  revealed: 'REVEALED',
  newEstimationRoundStarted: 'NEW_ESTIMATION_ROUND_STARTED',
  excludedFromEstimations: 'EXCLUDED_FROM_ESTM',
  includedInEstimations: 'INCLUDED_IN_ESTM',
  storyChanged: 'STORY_CHANGED',
  storyDeleted: 'STORY_DELETED',
  storyTrashed: 'STORY_TRASHED',
  storyRestored: 'STORY_RESTORED',
  cardConfigSet: 'CARD_CONFIG_SET',
  autoRevealOn: 'AUTO_REVEAL_ON',
  autoRevealOff: 'AUTO_REVEAL_OFF',
  passwordSet: 'PASSWORD_SET',
  passwordCleared: 'PASSWORD_CLEARED',
  tokenIssued: 'TOKEN_ISSUED'
};

/** various **/
export const COMMAND_SENT = 'COMMAND_SENT';
export const EVENT_RECEIVED = 'EVENT_RECEIVED';
