import React from 'react';
import { connect } from 'react-redux';

import Backlog from '../components/Backlog';
import UserMenu from '../components/UserMenu';
import Users from '../components/Users';
import Estimation from '../components/Estimation';

const Board = ({ roomId, isAStorySelected }) => (
  <div className='board' id={roomId}>
    <Users />
    <UserMenu />
    <Backlog />
    {
      isAStorySelected &&
      <Estimation />
    }

  </div>
);

Board.propTypes = {
  roomId: React.PropTypes.string,
  isAStorySelected: React.PropTypes.bool
};


export default connect(
  state => ({
    roomId: state.get('roomId'),
    isAStorySelected: !!state.getIn(['stories', state.get('selectedStory')])
  })
)(Board);