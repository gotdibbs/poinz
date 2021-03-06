import React from 'react';
import {connect} from 'react-redux';
import PropTypes from 'prop-types';

import Help from '../Help/Help';
import FeedbackHint from './FeedbackHint';
import {isAStorySelected} from '../../services/selectors';
import Estimation from '../EstimationArea/EstimationArea';
import Settings from '../Settings/Settings';
import Users from '../Users/Users';
import ActionLog from '../ActionLog/ActionLog';
import Backlog from '../Backlog/Backlog';

import {StyledBoard} from './_styled';

/**
 * The board is the main working area as soon as a room was joined.
 * It contains
 * - the backlog
 * - a list of users,
 * - estimations
 * - the current story
 * - cards
 */
const Board = ({roomId, isAStorySelected}) => (
  <StyledBoard id={roomId}>
    <Users />
    <Settings />
    <ActionLog />
    <Help />
    <Backlog />
    {isAStorySelected && <Estimation />}

    <FeedbackHint />
  </StyledBoard>
);

Board.propTypes = {
  roomId: PropTypes.string,
  isAStorySelected: PropTypes.bool
};

export default connect((state) => ({
  roomId: state.roomId,
  isAStorySelected: isAStorySelected(state)
}))(Board);
