import React from "react";
import Enzyme, {mount, shallow} from "enzyme";
import Messenger from "../components/Messenger.js";
import Adapter from "enzyme-adapter-react-16";
import store from "../store";
import { Provider } from "react-redux";
import { findByAttr } from "../utils/testTools";
import * as ApiMessanger from "../api/messenger";
import DialogWindow from "../components/DialogWindow";
import { loadLeadInfoApi } from '../api/messenger'
Enzyme.configure({adapter: new Adapter()});

const leadsInit = [
  { leadId: 1, leadName: 'Lead Id1', phone: 2227778888 },
  { leadId: 2, leadName: 'Lead Id2', phone: 2227778882 },
  { leadId: 3, leadName: 'Lead Id3', phone: 2227778883 },
];

ApiMessanger.loadLeadInfoApi = jest.fn(leadId => new Promise((resolve) => {
  setTimeout(() => {
    resolve({
      data: {
        id: leadId,
        name: `Lead Id${leadId}`,
        phone: 2225557777
      }
    })
  }, 1500);
}));
ApiMessanger.loadTextsApi = jest.fn((leadId) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const texts = Array(20).fill({}).map((_, index) => ({
        id: index + 1,
        date: Date.now() + index,
        body: `Message ${index + 1} for ${leadId}`,
        isReply: Math.random() > 0.5,
        isDelivered: true,
      }));
      resolve({
        data: texts
      })
    }, 1500);
  });
});

describe("Precess leads", () => {
  let target;
  beforeEach(() => {
    target = mount(
        <Provider store={store}>
          <Messenger/>
        </Provider>
    );
  });
  afterEach(() => {
    target.unmount();
  });

  it("renders", () => {
    expect(target.exists()).toBe(true);
  });

  it("renders leads", () => {
    const leads = target.find('.leads-list li');
    expect(leads.length).toEqual(leadsInit.length);
  });

  leadsInit.forEach((lead, i) => {
    it('should open DialogWindow and send request with correct leadId', () => {
      findByAttr(target, `lead${i + 1}`).simulate("click");
      expect(findByAttr(target, `dialog-window${i + 1}`).exists()).toBe(true);
      expect(findByAttr(target, `dialog-window${i + 2}`).exists()).toBe(false);
      expect(ApiMessanger.loadLeadInfoApi).toHaveBeenCalledWith(i + 1);
      expect(ApiMessanger.loadLeadInfoApi).not.toHaveBeenCalledWith(i + 2);
    });
  })
});

describe("Process leads 2", () => {
  leadsInit.forEach((lead, i) => {
    it('should send update request', async () => {
      const dispatch = jest.fn();
      const instance = mount(
        <DialogWindow
          dispatch={dispatch}
          {...lead}
        />
      );
      await loadLeadInfoApi(i + 1);
      expect(dispatch).toHaveBeenCalledWith({
        data: {
          leadId: i + 1,
          leadName: `Lead Id${i + 1}`,
          phone: 2225557777
        },
        type: "UPDATE_DIALOG"
      });
      instance.unmount();
    });

    it('should send request for test and activate spiner', async () => {
      const dispatch = jest.fn();
      const target = shallow(
        <DialogWindow
          dispatch={dispatch}
          {...lead}
        />
      );
      expect(findByAttr(target, `loader`).exists()).toBe(true);
      expect(ApiMessanger.loadTextsApi).toHaveBeenCalledWith(i + 1);
      await ApiMessanger.loadTextsApi();
      expect(findByAttr(target, `loader`).exists()).toBe(false);
    });
  })
})
