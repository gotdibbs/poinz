import React from 'react';
import {connect} from 'react-redux';
import PropTypes from 'prop-types';

import JoinRoomForm from './JoinRoomForm';
import GithubRibbon from './GithubRibbon';
import {hasMatchingPendingCommand} from '../../services/selectors';
import {
  StyledActionLog,
  StyledEyecatcher,
  StyledLandingInner,
  StyledLanding,
  StyledLargeFontEyecatcher,
  StyledInfoText,
  StyledChangelog
} from './_styled';
import appConfig from '../../services/appConfig';

/**
 * The "landing" page where the user can enter a room name to join
 */
const Landing = ({t, waitingForJoin, actionLog}) => {
  if (waitingForJoin) {
    return (
      <StyledLanding>
        <GithubRibbon />
        <StyledLandingInner>
          <Loader t={t} />
        </StyledLandingInner>
      </StyledLanding>
    );
  }

  return (
    <StyledLanding>
      <GithubRibbon />
      <StyledLandingInner>
        <JoinRoomForm />

        <StyledEyecatcher>
          <StyledInfoText small={true}>
            <i className="icon-attention"></i>
            {t('disclaimer')}
          </StyledInfoText>
        </StyledEyecatcher>

        {actionLog && actionLog.length > 0 && (
          <StyledEyecatcher>
            <StyledActionLog>
              {actionLog.map((entry, index) => (
                <li key={`logline_${index}`}>
                  <span>{entry.tstamp}</span>
                  <span>{entry.message}</span>
                </li>
              ))}
            </StyledActionLog>
          </StyledEyecatcher>
        )}

        <StyledEyecatcher>
          <StyledChangelog
            dangerouslySetInnerHTML={{__html: appConfig.changeLog}}
          ></StyledChangelog>
        </StyledEyecatcher>
      </StyledLandingInner>
    </StyledLanding>
  );
};

Landing.propTypes = {
  t: PropTypes.func,
  waitingForJoin: PropTypes.bool,
  actionLog: PropTypes.array
};

export default connect((state) => ({
  t: state.translator,
  actionLog: state.actionLog,
  waitingForJoin: hasMatchingPendingCommand(state, 'joinRoom')
}))(Landing);

const Loader = ({t}) => <StyledLargeFontEyecatcher>{t('loading')}</StyledLargeFontEyecatcher>;

Loader.propTypes = {
  t: PropTypes.func
};
