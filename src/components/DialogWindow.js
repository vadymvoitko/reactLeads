import React, { PureComponent } from 'react'
import propTypes from 'prop-types'
import sortBy from 'lodash/sortBy'
import debounce from 'lodash/debounce'
import { Loader, Popup } from 'semantic-ui-react'
import ClickOutside from 'react-click-outside'
import {
  removeDialogWindow,
  updateDialog,
  addTextsToDialog,
  updateTextInDialog
} from '../actions/messenger'
import { makeInitials } from '../utils/helpers'
import CONST from '../utils/const'
import ErrorLabel from './ErrorLabel'
import { loadLeadInfoApi, loadTextsApi, sendTextApi } from '../api/messenger'

class DialogWindow extends PureComponent {
  static propTypes = {
    timestamp: propTypes.number,
    isActive: propTypes.bool,
    leadId: propTypes.number.isRequired,
    leadName: propTypes.string,
    phone: propTypes.number,
    newMessage: propTypes.string,
    view: propTypes.oneOf([
      CONST.DIALOG_WINDOW_VIEWS.opened,
      CONST.DIALOG_WINDOW_VIEWS.collapsed,
      CONST.DIALOG_WINDOW_VIEWS.hidden
    ]),
    textsData: propTypes.shape({
      texts: propTypes.array,
    }),
  };

  static defaultProps = {
    newMessage: '',
    textsData: {
      texts: []
    },
  }

  constructor(props) {
    super(props);
    this.inputId = `message-dialog-input-${this.props.leadId}`;
    this.updateNewMessageInStore = debounce(this.updateNewMessageInStore, 1000);
    this.state = {
      isLoadedLeadDetails: false,
      loading: true,
      newMessageError: '',
      newMessage: this.props.newMessage,
      newMessageInputSize: this.props.newMessageInputSize,
    }
  }

  componentDidMount() {
    const { isActive, leadId } = this.props;
    this.loadMessages();

    loadLeadInfoApi(leadId)
      .then(({ data: { name, phone } }) => {
        this.updateDialogData({
          leadName: name,
          phone
        });
        this.setState({ isLoadedLeadDetails: true });
        if (isActive) {
          this.focusNewMessageInput();
        }
        window.addEventListener('keydown', this.handleKeydown);
      })
      .catch(error => error.status === 404 && this.deleteDialog());
  }

  componentDidUpdate(prevProps, prevState) {
    const { isActive, view, textsData } = this.props;
    const { texts } = textsData;

    const firstLoad = !prevProps.textsData.texts.length && !!texts.length;
    const returnedToOpenedView = prevProps.view !== CONST.DIALOG_WINDOW_VIEWS.opened &&
      view === CONST.DIALOG_WINDOW_VIEWS.opened;

    if (firstLoad || returnedToOpenedView || prevProps.textsData.texts.length !== texts.length) {
      this.scrollDialogsToBottom();
    }
    if (!prevProps.isActive && isActive) {
      this.focusNewMessageInput();
    }
  }

  scrollDialogsToBottom = () => {
    if (this.props.view === CONST.DIALOG_WINDOW_VIEWS.opened) {
      if (this.messagesNode) {
        this.messagesNode.scrollTop = this.messagesNode.scrollHeight
      } else {
        setTimeout(this.scrollDialogsToBottom, 1000);
      }
    }
  };

  createTextDateUniqueName = date => `message-${date.toFixed(0)}`;

  focusNewMessageInput = () => {
    setTimeout(() => {
      const newMessageInputElement = document.getElementById(this.inputId);
      if (newMessageInputElement) {
        newMessageInputElement.focus();
        newMessageInputElement.click();
      }
    }, 0);
  }

  handleKeydown = ({ keyCode }) => keyCode === 27 && !!this.props.isActive && this.deleteDialog();

  loadMessages = () => {
    this.setState({ loading: true });

    const { leadId } = this.props;

    loadTextsApi(leadId)
      .then(({ data: texts }) => {
        // console.log('texts', texts);
        const updatedTextsData = {
          texts: sortBy(texts, ['date'])
        };

        this.props.dispatch(addTextsToDialog({ leadId, textsData: updatedTextsData }));
        this.setState({ loading: false });
      })
      .catch((error) => {
        this.setState({ loading: false });
      });
  }

  updateDialogData = updates => this.props.dispatch(updateDialog({ ...updates, leadId: this.props.leadId }));

  updateDialogView = view => this.updateDialogData({ view });

  setOpenedDialogView = () => this.updateDialogView(CONST.DIALOG_WINDOW_VIEWS.opened);

  setCollapsedDialogView = () => { console.log('updateDialogView'); this.updateDialogView(CONST.DIALOG_WINDOW_VIEWS.collapsed) };

  deleteDialog = () => {
    this.props.dispatch(removeDialogWindow(this.props.leadId));
  }

  setActiveDialogStatus = () => this.updateDialogData({ view: CONST.DIALOG_WINDOW_VIEWS.opened, isActive: true });

  handleClickOutside = () => this.props.isActive && this.updateDialogData({ isActive: false });

  handleClickInside = ({ target }) => {
    if (!target.getAttribute('data-view') && !this.props.isActive) {
      this.setActiveDialogStatus();
    }
  };

  updateNewMessageInStore() {
    this.updateDialogData({
      newMessage: this.state.newMessage,
    });
  }

  updateNewMessage(newMessageUpdate) {
    this.setState(newMessageUpdate);
    this.updateNewMessageInStore(newMessageUpdate);
  }

  handleNewMessageChange = ({ target: { value: newMessage } }) => {
    this.state.newMessageError && this.setState({ newMessageError: '' });
    this.updateNewMessage({
      newMessage,
    });
  }

  handleNewMessageKeydown = (event) => {
    const { which, shiftKey } = event;
    if (which === 13 && !shiftKey) {
      event.preventDefault();
      this.sendNewMessage();
    }
  }

  sendNewMessage = () => {
    const { phone, leadId, dispatch } = this.props;
    const { newMessage: newMessageUnformatted } = this.state;

    const newMessage = newMessageUnformatted.trim();
    if (newMessage) {
      const textToBeSent = {
        phone,
        body: newMessage,
        templateId: null
      };
      const date = Date.now() / 1000;

      // Instantly save new message to show it in the list. Use temporary id before receiving the real one from POST response
      const temporaryTextId = Date.now() + Math.random();
      const textToBeSaved = {
        phone,
        date,
        id: temporaryTextId,
        body: newMessage,
        isSending: true,
        isReply: false,
        isSentByActionPlan: false
      };
      dispatch(
        addTextsToDialog({ leadId, textsData: { texts: [textToBeSaved] }, extendOriginalTextsList: true })
      );

      this.updateNewMessage({
        newMessage: ''
      });

      sendTextApi(leadId, textToBeSent)
        .then(({ data: { date, id } }) => {
          // Update id and date of sending of the text
          dispatch(updateTextInDialog({
            leadId,
            textId: temporaryTextId,
            updates: { date, id }
          }));
        })
        .catch(({ error: newMessageError }) => {
          dispatch(updateTextInDialog({
            leadId,
            textId: temporaryTextId,
            updates: { reason: newMessageError, isSending: false },
          }));
        });
    } else {
      this.setState({ newMessageError: 'Please add the text to the message' });
    }
  }

  handleFreeSpaceClick = () => {
    // console.log('this.props.view', this.props.view);
    this.props.view === CONST.DIALOG_WINDOW_VIEWS.collapsed ?
    this.setOpenedDialogView() :
    this.setCollapsedDialogView() };

  renderMessages(texts) {
    const { leadName, leadId } = this.props;

    return texts.map(({ date, body, isReply, isSending, isDelivered, reason }, index) => {

      return (
        <div data-test={`message${index}`} key={`${date}-${index}`}>
          <div className={`dialog-message ${isReply ? 'dialog-message--reply' : ''} flex-row`}>
            {isReply && (
              <a
                href={`/lead/${leadId}/send-text`}
                className="dialog-message__image-wrapper initials-image flex-row"
              >
                {makeInitials(leadName)}
              </a>
            )}
            {!isReply && (
              <div className="dialog-message__message-info-icons">
                {isSending && <Loader size="small" className="dialog-message__message-loader" />}
                {!isSending && !isDelivered && (
                  <i className="fas fa-exclamation-circle dialog-message__error-icon"></i>
                )}
              </div>
            )}

            <div
              id={this.createTextDateUniqueName(date)}
              className={`dialog-message__message ${isReply ? 'dialog-message__message--reply' : ''} ${!isDelivered ? 'dialog-message__message--error' : ''}`}>
              <pre>{body}</pre>
            </div>

          </div>
        </div>
      )
    })
  }

  render() {
    const { isActive, leadName, leadId, view, textsData: { texts } } = this.props;
    const { loading, newMessageError, newMessage,} = this.state;
    const isCollapsed = view === CONST.DIALOG_WINDOW_VIEWS.collapsed;
    const isOpened = view === CONST.DIALOG_WINDOW_VIEWS.opened;
    const leadNameElement = (
      <Popup
        trigger={(
          <a
            href={`/lead/${leadId}/send-text`}
            className="dialog-window__header-name dialog-window__header-name--link"
          >
            {leadName}
          </a>
        )}
        content={leadName}
        inverted
      />
    );
    return (
      <ClickOutside onClickOutside={this.handleClickOutside} onClick={this.handleClickInside}>
        <div
          data-testid={`message-dialog-for-${leadId}`}
          className={`content-box dialog-window ${isActive ? 'dialog-window--active' : ''} ${isCollapsed ? 'dialog-window--collapsed' : ''}`}
        >
          <Loader
            data-test={loading && 'loader'}
            size='large'
            active={loading}
            className="dialog-window__loader"
          />

          <div className={`flex-row dialog-window__header`}>
            {leadNameElement}
            <div className="flex-row dialog-window__header-icons">
              <span
                onClick={this.handleFreeSpaceClick}
                className="dialog-window__header-free-space">
              </span>
              {isOpened && (
                <span
                  data-view="collapsed"
                  onClick={this.setCollapsedDialogView}
                  className="dialog-window__header-icon fas fa-minus">
                  -
                </span>
              )}
              <span
                data-view="hidden"
                onClick={this.deleteDialog}
                className="dialog-window__header-icon fas fa-times">
                X
              </span>
            </div>
          </div>
          {!isCollapsed && (
            <div
              data-test={loading && "message-container"}
              ref={messagesNode => this.messagesNode = messagesNode}
              className="dialog-window__messages"
            >
              {this.renderMessages(texts)}
            </div>
          )}
          {!isCollapsed && (
            <div className="dialog-window__input-wrapper">
              {newMessageError && (
                <ErrorLabel
                  className="dialog-window__input-wrapper-error-label"
                  pointing='below'
                  content={newMessageError}
                />
              )}
              <textarea
                value={newMessage}
                id={this.inputId}
                placeholder="Type a message"
                className={`dialog-window__input ${newMessageError ? 'dialog-window__input_error' : ''}`}
                onChange={this.handleNewMessageChange}
                onKeyDown={this.handleNewMessageKeydown}
                rows="1"
              />
              {!!newMessage && (
                <Popup
                  hideOnScroll
                  position='top left'
                  trigger={(
                    <i onClick={this.sendNewMessage} className="fas fa-location-arrow dialog-window__input-helper"></i>
                  )}
                  content="Press Enter to Send"
                  inverted
                />
              )}
            </div>
          )}
        </div>
      </ClickOutside>
    );
  }

  componentWillUnmount() {
    window.removeEventListener('keydown', this.handleKeydown);
  }
}

export default DialogWindow;
