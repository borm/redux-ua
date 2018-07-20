const createActions = (prefix, actionsObject) => {
  const keys = Object.keys(actionsObject);
  const actions = {};

  keys.forEach((key) => {
    const actionId = `${prefix.toUpperCase()}__${key.replace(/[A-Z]/g, '-$&').toUpperCase()}`;
    const actionTypes = ['BEGIN', 'SUCCESS', 'FAILED']
      .map(type => `${actionId}_${type}`);

    const [ BEGIN, SUCCESS, FAILED ] = actionTypes;

    let isResultExist = false;
    const action = (...args) => async (dispatch, getState) => {
      dispatch({ key, type: BEGIN, payload: { loading: true, data: {} } });
      try {
        let result = await actionsObject[key](...args);
        if (typeof result === 'function') {
          result = await result(dispatch, getState);
        }
        if (result) {
          isResultExist = true;
          dispatch({ key, type: SUCCESS, payload: { loading: false, data: result } });
        }
      } catch (e) {
        dispatch({ key, type: FAILED, payload: { loading: false, data: e } });
      }
    };
    if (isResultExist) {
      action.key = key;
    }
    action.types = actionTypes;
    action.toString = () => key;

    actions[key] = action;
  });

  return actions;
};

const handleActions = (actions, initialState, handlers) => {
  const keys = Object.keys(actions);
  let actionTypes = [];
  keys.forEach((key) => {
    /**
     * Create default reducers
     */
    if (!handlers[key]) {
      const { types } = actions[key];
      actionTypes = actionTypes.concat(types);
      // eslint-disable-next-line no-param-reassign
      handlers[key] = (state, { payload }) => ({ ...state, [key]: payload });
    }
  });

  return (state = initialState, action = {}) => {
    let reducer;
    if (actionTypes.includes(action.type)) {
      reducer = handlers[action.key];
    }

    if (reducer) {
      return reducer(state, action);
    }
    return state;
  };
};

export { createActions };
export { handleActions };