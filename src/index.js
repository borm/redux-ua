export function createActions(prefix, actions) {
  return Object.keys(actions).reduce((accumulator, key) => {
    const actionId = `${prefix.toUpperCase()}__${key
      .replace(/[A-Z]/g, '-$&')
      .toUpperCase()}`;

    const actionTypes = ['BEGIN', 'SUCCESS', 'FAILED'].map(
      type => `${actionId}_${type}`
    );

    const [begin, success, failed] = actionTypes;

    // let isResultExist = false;
    const { isAsync, isPure, isCompose } = actions[key];

    const action = (...args) => (dispatch, getState) => {
      if (isAsync) {
        dispatch({
          key,
          type: begin,
          payload: { loaded: false, loading: true, data: undefined },
        });
      }

      return new Promise(async (resolve, reject) => {
        try {
          let result = await actions[key](...args);
          if (typeof result === 'function') {
            result = await result(dispatch, getState);
          }

          if (isAsync) {
            dispatch({
              key,
              type: success,
              payload: { loaded: true, loading: false, data: result },
            });
          }
          if (isPure) {
            dispatch({ key, type: actionId, payload: result });
          }

          if (isCompose) {
            dispatch({ key, type: actionId, payload: result });
          }
          resolve(result);
        } catch (error) {
          if (isAsync) {
            dispatch({ key, type: failed, payload: { loaded: true, loading: false, error } });
          }
          if (isPure) {
            dispatch({ key, type: actionId, payload: error });
          }
          reject(error);
        }
      });
    };

    /*if (isResultExist) {
      action.key = key;
    }*/

    action.type = actionId;
    action.types = actionTypes;

    action.toString = () => actionId;
    action.begin = begin;
    action.success = success;
    action.failed = failed;

    action.isAsync = isAsync;
    action.isPure = isPure;
    action.isCompose = isCompose;

    return {
      ...accumulator,
      [key]: action,
    };
  }, {});
}

export function handleActions(actions, handlers = {}, initialState = {}) {
  let actionTypes = [];
  Object.keys(actions).forEach(key => {
    const action = actions[key];

    const { isAsync, isPure, isCompose, type, types } = action;
    /**
     * Push actionTypes
     */
    if (isAsync) {
      actionTypes = actionTypes.concat(types);
    }

    if (isPure || isCompose) {
      actionTypes = actionTypes.concat([type]);
    }

    /**
     * Create default state
     */
    if (typeof initialState[key] === 'undefined') {
      if (isAsync) {
        // eslint-disable-next-line no-param-reassign
        initialState[key] = { loaded: false, loading: false, data: undefined };
      }

      if (isPure) {
        // eslint-disable-next-line no-param-reassign
        initialState[key] = null;
      }
    }

    /**
     * Create default reducers
     */
    if (isAsync) {
      types.forEach(t => {
        if (!handlers[t]) {
          // eslint-disable-next-line no-param-reassign
          handlers[t] = (state, { payload }) => ({ ...state, [key]: { ...payload, loaded: state[key].loaded || payload.loaded } });
        }
      });
    }

    if (isPure && !handlers[type]) {
      // eslint-disable-next-line no-param-reassign
      handlers[type] = (state, { payload }) => ({ ...state, [key]: payload });
    }
  });

  return (state = initialState, action = {}) => {
    let reducer;
    if (actionTypes.includes(action.type)) {
      reducer = handlers[action.type];
    }

    if (reducer) {
      return reducer(state, action);
    }
    return state;
  };
}

export function async(func) {
  if (func && typeof func === 'function') {
    // eslint-disable-next-line no-param-reassign
    func.isAsync = true;
    return func;
  }
  return (target, name, descriptor) => {
    // eslint-disable-next-line no-param-reassign
    descriptor.value.isAsync = true;
    return descriptor;
  };
}

export function pure(func) {
  if (func && typeof func === 'function') {
    // eslint-disable-next-line no-param-reassign
    func.isPure = true;
    return func;
  }
  return (target, name, descriptor) => {
    // eslint-disable-next-line no-param-reassign
    descriptor.value.isPure = true;
    return descriptor;
  };
}

export function compose(func) {
  if (func && typeof func === 'function') {
    // eslint-disable-next-line no-param-reassign
    func.isCompose = true;
    return func;
  }
  return (target, name, descriptor) => {
    // eslint-disable-next-line no-param-reassign
    descriptor.value.isCompose = true;
    return descriptor;
  };
}
