import React, { PureComponent } from 'react'
import { connect } from 'react-redux'
import DialogWindow from './DialogWindow'
import CONST from '../utils/const'
import { initDialogWindow, updateTextInDialog } from '../actions/messenger';

const leads = [
  { leadId: 1, leadName: 'Lead Id1', phone: 2227778888 },
  { leadId: 2, leadName: 'Lead Id2', phone: 2227778882 },
  { leadId: 3, leadName: 'Lead Id3', phone: 2227778883 },
];

class Messenger extends PureComponent {
  componentDidMount() {
    // window.Echo.private().notification(this.handleNewNotification);
  }

  // handleNewNotification = (notificationResponse) => {
  //   const { type, leadId, isDelivered, textId } = notificationResponse;
  //   if (type === 'App\\Notifications\\TextStatusActivity') {
  //     this.props.dispatch(updateTextInDialog({
  //       leadId,
  //       textId,
  //       updates: { isDelivered, isSending: false }
  //     }));
  //   }
  // }

  handleLeadClick = lead => {
    this.props.dispatch(initDialogWindow(lead))
  };

  separateDialogs(dialogs) {
    const hiddenDialogs = dialogs.filter(dialog => dialog.view === CONST.DIALOG_WINDOW_VIEWS.hidden);
    const visibleDialogs = dialogs.filter(dialog => dialog.view !== CONST.DIALOG_WINDOW_VIEWS.hidden);
    return { hiddenDialogs, visibleDialogs };
  }

  render() {
    const { dialogs, dispatch } = this.props;
    const { visibleDialogs } = this.separateDialogs(dialogs);

    return (
      <div className="messenger flex-row flex-row_gorizontal-start">
        <div className="leads-list">
          <h2>Leads list</h2>
          <ul>
            {leads.map(lead => (
              <li
                  id={lead.leadId}
                  data-test={`lead${lead.leadId}`}
                  onClick={() => this.handleLeadClick(lead)}
              >
                {lead.leadName}
              </li>
            ))}
          </ul>
        </div>
        {visibleDialogs.map(visibleDialog => (
          <DialogWindow
            data-test={`dialog-window${visibleDialog.leadId}`}
            key={visibleDialog.leadId}
            dispatch={dispatch}
            {...visibleDialog}
          />
        ))}
      </div>
    );
  }
}

export default connect(state => {
  const { messenger } = state;
  const { dialogs, showHiddenDialogsList, maxAvailableOpenedDialogs } = messenger;
  return {
    messenger,
    dialogs,
    showHiddenDialogsList,
    maxAvailableOpenedDialogs,
  }
})(Messenger);
