import log from 'loglevel';
import {v4 as uuid} from 'uuid';

import {EVENT_ACTION_TYPES} from '../actions/types';
import clientSettingsStore from '../store/clientSettingsStore';
import initialState from '../store/initialState';
import {getCardConfigForValue} from './getCardConfigForValue';
import {formatTime} from './timeUtil';
import {indexEstimations, indexStories, indexUsers} from './roomStateMapper';

/**
 * The event reducer handles backend-event actions.
 * These are equivalent to the event handlers in the backend as they modify the room state.
 *
 * @param {object} state
 * @param {object} action
 * @returns {object} the modified state
 */
export default function eventReducer(state, action) {
  const {event} = action;

  if (isFailedJoinRoom(event)) {
    const reason = event.payload.reason;

    // with issue #99 we introduced a new validation for usernames.
    // if the preset username (previously stored in localStorage) does not match the new format, joinRoom will fail.
    if (reason.includes('validation Error') && reason.includes('/username')) {
      clientSettingsStore.setPresetUsername('');
      return {...state, presetUsername: ''};
    }

    if (reason.includes('Not Authorized')) {
      // joinRoom failed to a a password-protected room. Let's store the roomId on our state
      return {...state, authorizationFailed: event.payload.command.roomId};
    }
  }

  // if we created a new room, and then joined, we don't have a roomId yet
  if (!state.roomId && event.name === 'joinedRoom') {
    state.roomId = event.roomId;
  }

  // Events from other rooms do not affect us (backend should not send such events in the first place)
  if (state.roomId !== event.roomId) {
    log.warn(
      `Event with different roomId received. localRoomId=${state.roomId}, eventRoomId=${event.roomId} (${event.name})`
    );
    return state;
  }

  const matchingHandler = eventActionHandlers[action.type];
  if (!matchingHandler) {
    log.warn('No matching backend-event handler for', action);
    return state;
  }

  let modifiedState = matchingHandler.fn(state, event.payload, event) || state;
  modifiedState = updateActionLog(matchingHandler.log, state, modifiedState, event);
  return modifiedState;
}

function isFailedJoinRoom(event) {
  return (
    event.name === 'commandRejected' &&
    event.payload &&
    event.payload.command &&
    event.payload.command.name === 'joinRoom'
  );
}

/**
 * adds a log message for a backend event to the state.
 *
 * @param {undefined | string | function} logObject defined in event handlers.
 *         If this is a function: username, eventPayload, oldState and newState will be passed.
 *         The function can return undefined or empty string/undefined (then no logEntry will be added)
 * @param {object} oldState The state before the action was reduced
 * @param {object} modifiedState The state after the action was reduced
 * @param {object} event
 * @returns {object} The new state containing updated actionLog
 */
function updateActionLog(logObject, oldState, modifiedState, event) {
  if (!logObject) {
    return modifiedState;
  }

  const matchingUser = modifiedState.users && modifiedState.users[event.userId];
  const username = matchingUser ? matchingUser.username || '' : '';
  const messageObject =
    typeof logObject === 'function'
      ? logObject(username, event.payload, oldState, modifiedState, event)
      : logObject;

  if (!messageObject) {
    return modifiedState;
  }

  const newLogItem = {
    tstamp: formatTime(Date.now()),
    logId: uuid()
  };
  if (typeof messageObject === 'string') {
    newLogItem.message = messageObject;
  } else {
    newLogItem.message = messageObject.message;
    newLogItem.isError = messageObject.isError;
  }

  return {
    ...modifiedState,
    actionLog: [newLogItem, ...(modifiedState.actionLog || [])]
  };
}

/**
 * Map of event handlers.
 *
 * Defines the modification (application/reduction) a backend event performs on our state.
 * Also defines an optional log function or string (this is separated intentionally - even though it is technically also a modification to the state).
 *
 * TODO:  decide/discuss whether we should split these up into separate files (similar to backend)
 */
const eventActionHandlers = {
  /**
   * If the user joins a room that does not yet exist, it is created by the backend.
   * It will be followed by a "joinedRoom" event.
   */
  [EVENT_ACTION_TYPES.roomCreated]: {
    fn: (state) => state,
    log: (username, payload) => `Room "${payload.id}" created`
  },

  /**
   * A user joined the room. This can be either your own user or someone else joined the room.
   */
  [EVENT_ACTION_TYPES.joinedRoom]: {
    fn: (state, payload, event) => {
      if (state.pendingJoinCommandId && state.pendingJoinCommandId === event.correlationId) {
        // you joined

        clientSettingsStore.setPresetUserId(event.userId);

        // server sends current room state (users, stories, etc.)
        return {
          ...state,
          roomId: event.roomId,
          userId: event.userId,
          selectedStory: payload.selectedStory,
          highlightedStory: payload.selectedStory,
          users: indexUsers(payload.users),
          stories: indexStories(payload.stories),
          estimations: indexEstimations(payload.stories),
          pendingJoinCommandId: undefined,
          authorizationFailed: undefined,
          cardConfig: payload.cardConfig,
          autoReveal: payload.autoReveal,
          passwordProtected: !!payload.passwordProtected
        };
      } else {
        // if our client state has already a userId set, this event indicates that someone else joined, we only need to update our list of users in the room
        return {
          ...state,
          users: indexUsers(payload.users)
        };
      }
    },
    log: (username, payload, oldState, newState, event) => {
      const youJoined = !oldState.userId;

      if (youJoined) {
        return `You joined room "${newState.roomId}"`;
      }

      return `${newState.users[event.userId].username || 'New user'} joined`; // cannot directly use parameter "username". event is not yet reduced.
    }
  },

  /**
   * A user left the room. This can be either your own user. Or someone else left the room.
   */
  [EVENT_ACTION_TYPES.leftRoom]: {
    fn: (state, payload, event) => {
      // If your user (in this or in another browser) left the room
      if (state.userId === event.userId) {
        return {...initialState()};
      }

      // If someone else left the room
      const modifiedUsers = {...state.users};
      delete modifiedUsers[event.userId];

      return {
        ...state,
        users: modifiedUsers
      };
    },
    log: (username, payload, oldState, newState, event) =>
      `${oldState.users[event.userId].username || 'New user'} left the room`
  },

  /**
   * A user was kicked from the room.
   */
  [EVENT_ACTION_TYPES.kicked]: {
    fn: (state, payload) => {
      if (payload.userId === state.userId) {
        // you got kicked ;)
        return {...initialState()};
      }

      // We need to take the userId from the payload (the user that was kicked, not the "kicking" user)
      const modifiedUsers = {...state.users};
      delete modifiedUsers[payload.userId];

      return {
        ...state,
        users: modifiedUsers
      };
    },
    log: (username, payload, oldState, modifiedState, event) =>
      `${oldState.users[payload.userId].username || 'New user'} was kicked from the room by ${
        oldState.users[event.userId].username
      }`
  },

  /**
   * A user in the room lost the connection to the server.
   */
  [EVENT_ACTION_TYPES.connectionLost]: {
    fn: (state, payload, event) => {
      if (!state.users || !state.users[event.userId]) {
        return state;
      }

      return {
        ...state,
        users: {
          ...state.users,
          [event.userId]: {
            ...state.users[event.userId],
            disconnected: true
          }
        }
      };
    },
    log: (username) => `${username || 'New user'} lost the connection`
  },

  [EVENT_ACTION_TYPES.storyAdded]: {
    fn: (state, payload) => {
      const modifiedStories = {...state.stories};
      modifiedStories[payload.storyId] = {
        id: payload.storyId,
        title: payload.title,
        description: payload.description,
        createdAt: payload.createdAt
      };
      return {
        ...state,
        stories: modifiedStories
      };
    },
    log: (username, payload) => `${username} added new story "${payload.title}"`
  },

  [EVENT_ACTION_TYPES.storyChanged]: {
    fn: (state, payload) => {
      const modifiedStory = {
        ...state.stories[payload.storyId],
        title: payload.title,
        description: payload.description,
        editMode: false
      };

      return {...state, stories: {...state.stories, [payload.storyId]: modifiedStory}};
    },
    log: (username, payload) => `${username} changed story "${payload.title}"`
  },

  [EVENT_ACTION_TYPES.storyTrashed]: {
    fn: (state, payload) => {
      const modifiedStory = {
        ...state.stories[payload.storyId],
        trashed: true
      };

      return {
        ...state,
        highlightedStory:
          state.highlightedStory === payload.storyId ? undefined : state.highlightedStory,
        stories: {
          ...state.stories,
          [payload.storyId]: modifiedStory
        }
      };
    },
    log: (username, payload, oldState) => {
      const storyTitle = oldState.stories[payload.storyId].title;
      return `${username} moved story "${storyTitle}" to trash`;
    }
  },

  [EVENT_ACTION_TYPES.storyRestored]: {
    fn: (state, payload) => {
      const modifiedStory = {
        ...state.stories[payload.storyId],
        trashed: false
      };

      return {
        ...state,
        stories: {
          ...state.stories,
          [payload.storyId]: modifiedStory
        }
      };
    },
    log: (username, payload, oldState) => {
      const storyTitle = oldState.stories[payload.storyId].title;
      return `${username} restored story "${storyTitle}" from trash`;
    }
  },

  [EVENT_ACTION_TYPES.storyDeleted]: {
    fn: (state, payload) => {
      const modifiedStories = {...state.stories};
      delete modifiedStories[payload.storyId];

      return {
        ...state,
        stories: modifiedStories
      };
    },
    log: (username, payload, oldState) => {
      const storyTitle = oldState.stories[payload.storyId].title;
      const consensus = oldState.stories[payload.storyId].consensus;
      let logline = `${username} deleted story "${storyTitle}"`;
      if (consensus) {
        logline = logline + `. It was estimated ${consensus}`;
      }
      return logline;
    }
  },

  /**
   * the selected story was set (i.e. the one that can be currently estimated by the team)
   * not to be confused with "highlighted" (which is just the "marked" story in the list of stories)
   */
  [EVENT_ACTION_TYPES.storySelected]: {
    fn: (state, payload) => ({
      ...state,
      selectedStory: payload.storyId,
      highlightedStory: state.highlightedStory || payload.storyId,
      applause: false
    }),
    log: (username, payload, oldState, newState) =>
      payload.storyId
        ? `${username} selected current story "${newState.stories[payload.storyId].title}"`
        : 'Currently no story is selected'
  },

  /**
   * the story csv import failed
   */
  [EVENT_ACTION_TYPES.importFailed]: {
    fn: (state) => state,
    log: (username, payload) => 'CSV import failed. ' + payload.message
  },

  [EVENT_ACTION_TYPES.usernameSet]: {
    fn: (state, payload, event) => {
      const isOwnUser = state.userId === event.userId;

      if (isOwnUser) {
        clientSettingsStore.setPresetUsername(payload.username);
      }

      const modifiedUsers = {
        ...state.users,
        [event.userId]: {...state.users[event.userId], username: payload.username}
      };
      return {
        ...state,
        users: modifiedUsers,
        presetUsername: isOwnUser ? payload.username : state.presetUsername
      };
    },
    log: (username, payload, oldState, newState, event) => {
      const oldUsername = oldState.users[event.userId].username;
      const newUsername = payload.username;

      if (oldUsername && oldUsername !== newUsername) {
        return `"${oldState.users[event.userId].username}" is now called "${newUsername}"`;
      }

      if (!oldUsername && newUsername) {
        // user set his username after first join, where user is in room, but username is not yet set (=undefined).
        return `New user is now called "${newUsername}"`;
      }
    }
  },

  [EVENT_ACTION_TYPES.emailSet]: {
    fn: (state, payload, event) => {
      const isOwnUser = state.userId === event.userId;

      if (isOwnUser) {
        clientSettingsStore.setPresetEmail(payload.email);
      }

      return {
        ...state,
        users: {
          ...state.users,
          [event.userId]: {
            ...state.users[event.userId],
            email: payload.email,
            emailHash: payload.emailHash
          }
        },
        presetEmail: isOwnUser ? payload.email : state.presetEmail
      };
    },
    log: (username, payload, oldState, newState, event) =>
      `${oldState.users[event.userId].username} set his/her email address`
  },

  [EVENT_ACTION_TYPES.avatarSet]: {
    fn: (state, payload, event) => {
      const isOwnUser = state.userId === event.userId;

      if (isOwnUser) {
        clientSettingsStore.setPresetAvatar(payload.avatar);
      }

      return {
        ...state,
        users: {
          ...state.users,
          [event.userId]: {...state.users[event.userId], avatar: payload.avatar}
        },
        presetAvatar: isOwnUser ? payload.avatar : state.presetAvatar
      };
    },
    log: (username, payload, oldState, newState, event) =>
      `${oldState.users[event.userId].username || 'New user'} set his/her avatar`
  },

  /**
   * user was excluded from estimations (flag for a user was set / toggled on)
   */
  [EVENT_ACTION_TYPES.excludedFromEstimations]: {
    fn: (state, payload, event) => ({
      ...state,
      users: {
        ...state.users,
        [event.userId]: {...state.users[event.userId], excluded: true}
      }
    }),
    log: (username) => `${username} is now excluded from estimations`
  },

  /**
   * user was included in estimations (flag for a user was unset / toggled off)
   */
  [EVENT_ACTION_TYPES.includedInEstimations]: {
    fn: (state, payload, event) => ({
      ...state,
      users: {
        ...state.users,
        [event.userId]: {...state.users[event.userId], excluded: false}
      }
    }),
    log: (username) => `${username} is no longer excluded from estimations`
  },

  [EVENT_ACTION_TYPES.storyEstimateGiven]: {
    fn: (state, payload, event) => ({
      ...state,
      estimations: {
        ...state.estimations,
        [payload.storyId]: {
          ...state.estimations[payload.storyId],
          [event.userId]: payload.value
        }
      }
    })
    // do not log -> if user is uncertain and switches between cards -> gives hints to other colleagues
  },

  [EVENT_ACTION_TYPES.consensusAchieved]: {
    fn: (state, payload) => ({
      ...state,
      applause: true,
      stories: {
        ...state.stories,
        [payload.storyId]: {
          ...state.stories[payload.storyId],
          consensus: payload.value
        }
      }
    }),
    log: (username, eventPayload, oldState, modifiedState) => {
      const matchingCardConfig = getCardConfigForValue(
        oldState.cardConfig,
        modifiedState.stories[eventPayload.storyId].consensus
      );
      return `Consensus achieved for story "${
        modifiedState.stories[eventPayload.storyId].title
      }": ${matchingCardConfig ? matchingCardConfig.label : '-'}`;
    }
  },

  [EVENT_ACTION_TYPES.storyEstimateCleared]: {
    fn: (state, payload, event) => {
      const modifiedEstimations = {...state.estimations[payload.storyId]};
      delete modifiedEstimations[event.userId];

      return {
        ...state,
        estimations: {
          ...state.estimations,
          [payload.storyId]: modifiedEstimations
        }
      };
    }
    // do not log -> if user is uncertain and switches between cards -> gives hints to other colleagues
  },

  [EVENT_ACTION_TYPES.revealed]: {
    fn: (state, payload) => ({
      ...state,
      stories: {
        ...state.stories,
        [payload.storyId]: {...state.stories[payload.storyId], revealed: true}
      }
    }),
    log: (username, payload, oldState, modifiedState) =>
      payload.manually
        ? `${username} manually revealed estimates for story "${
            modifiedState.stories[payload.storyId].title
          }"`
        : `Estimates were automatically revealed for story "${
            modifiedState.stories[payload.storyId].title
          }"`
  },

  [EVENT_ACTION_TYPES.newEstimationRoundStarted]: {
    fn: (state, payload) => ({
      ...state,
      applause: false,
      stories: {
        ...state.stories,
        [payload.storyId]: {
          ...state.stories[payload.storyId],
          revealed: false,
          consensus: undefined
        }
      },
      estimations: {
        ...state.estimations,
        [payload.storyId]: undefined
      }
    }),
    log: (username, payload, oldState, modifiedState) =>
      `${username} started a new estimation round for story "${
        modifiedState.stories[payload.storyId].title
      }"`
  },

  [EVENT_ACTION_TYPES.cardConfigSet]: {
    fn: (state, payload) => ({
      ...state,
      cardConfig: payload.cardConfig
    }),
    log: (username) => `${username} set new custom card configuration for this room`
  },

  [EVENT_ACTION_TYPES.autoRevealOn]: {
    fn: (state) => ({
      ...state,
      autoReveal: true
    }),
    log: (username) => `${username} enabled auto reveal for this room`
  },

  [EVENT_ACTION_TYPES.autoRevealOff]: {
    fn: (state) => ({
      ...state,
      autoReveal: false
    }),
    log: (username) => `${username} disabled auto reveal for this room`
  },

  [EVENT_ACTION_TYPES.passwordSet]: {
    fn: (state) => ({
      ...state,
      passwordProtected: true
    }),
    log: (username) => `${username} set a password for this room`
  },

  [EVENT_ACTION_TYPES.passwordCleared]: {
    fn: (state) => ({
      ...state,
      passwordProtected: false
    }),
    log: (username) => `${username} removed password protection for this room`
  },

  [EVENT_ACTION_TYPES.tokenIssued]: {
    fn: (state, payload) => ({
      ...state,
      userToken: payload.token
    })
    // do not log
  },

  [EVENT_ACTION_TYPES.commandRejected]: {
    fn: (state, payload, event) => {
      log.error(event);
      return {
        ...state,
        unseenError: true
      };
    },
    log: (username, payload) => ({
      message: `Command "${payload.command.name}" was not successful. \n ${payload.reason}`,
      isError: true
    })
  }
};
