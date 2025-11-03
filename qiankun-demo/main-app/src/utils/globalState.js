import { initGlobalState } from 'qiankun';

const initialState = {
    loading: false,
    globalMessage: null,
    vue2ToVue3: null
};

const actions = initGlobalState(initialState);

export { actions as default, initialState };
