interface DecoratedFunction extends Function {
  key: string;
  type: string;
  types: [];
  isCompose: boolean;
  isAsync: boolean;
  isPure: boolean;
}

export function createAction(key: string, handler: DecoratedFunction) {
  const actionId = `${key.toUpperCase()}`;

  const actionTypes = ['BEGIN', 'SUCCESS', 'FAILED'].map(
    (type: string) => `${actionId}_${type}`
  );

  const [begin, success, failed] = actionTypes;

  const { isAsync, isPure, isCompose } = handler;

  const action = (...args: any[]) => (
    dispatch: ({}) => object,
    getState: () => {}
  ) => {
    if (isAsync) {
      dispatch({
        type: begin,
        payload: { loaded: false, loading: true, data: undefined },
      });
    }

    return new Promise(async (resolve, reject) => {
      try {
        let result = await handler(...args);
        if (typeof result === 'function') {
          result = await result(dispatch, getState);
        }

        if (isAsync) {
          dispatch({
            type: success,
            payload: { loaded: true, loading: false, data: result },
          });
        }
        if (isPure) {
          dispatch({ type: actionId, payload: result });
        }

        if (isCompose) {
          dispatch({ type: actionId, payload: result });
        }
        resolve(result);
      } catch (error) {
        if (isAsync) {
          dispatch({
            type: failed,
            payload: { loaded: true, loading: false, error },
          });
        }
        if (isPure) {
          dispatch({ type: actionId, payload: error });
        }
        reject(error);
      }
    });
  };

  action.key = key;
  action.type = actionId;
  action.types = actionTypes;

  action.toString = () => actionId;
  action.begin = begin;
  action.success = success;
  action.failed = failed;

  action.isAsync = isAsync;
  action.isPure = isPure;
  action.isCompose = isCompose;

  return action;
}

export function createActions(prefix: string, actions: { [key: string]: any }) {
  return Object.keys(actions).reduce((accumulator: {}, key: string) => {
    const actionId = `${prefix.toUpperCase()}__${key
      .replace(/[A-Z]/g, '-$&')
      .toUpperCase()}`;

    const action = createAction(actionId, actions[key]);
    action.key = key;

    return {
      ...accumulator,
      [key]: action,
    };
  }, {});
}

export function handleActions(
  actions:
    | {
        [key: string]: DecoratedFunction;
      }
    | DecoratedFunction,
  handlers: { [key: string]: any } = {},
  initialState: { [key: string]: any } | null = {}
) {
  const isFunction = typeof actions === 'function';
  let actionTypes: string[] = [];

  const handleInitialState = (
    key: string,
    payload: { [key: string]: any } = {}
  ) =>
    isFunction
      ? payload
      : {
          ...initialState,
          [key]: payload,
        };

  const handleState = (
    key: string,
    state: { [key: string]: any } = {},
    payload: { [key: string]: any } = {}
  ) =>
    isFunction
      ? payload
      : {
          ...state,
          [key]: payload,
        };
  const handleAction = (key: string, action: DecoratedFunction) => {
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
        initialState = handleInitialState(key, {
          loaded: false,
          loading: false,
          data: undefined,
        });
      }

      if (isPure) {
        // eslint-disable-next-line no-param-reassign
        initialState = handleInitialState(key, null);
      }
    }

    /**
     * Create default reducers
     */
    if (isAsync) {
      types.forEach((t) => {
        if (!handlers[t]) {
          // eslint-disable-next-line no-param-reassign
          handlers[t] = (
            state: { [key: string]: { loaded: boolean } },
            { payload }: { payload: { loaded: boolean } }
          ) =>
            handleState(key, state, {
              ...payload,
              loaded: state[key].loaded || payload.loaded,
            });
        }
      });
    }

    if (isPure && !handlers[type]) {
      // eslint-disable-next-line no-param-reassign
      handlers[type] = (
        state: { [key: string]: {} },
        { payload }: { payload: {} }
      ) => handleState(key, state, payload);
    }
  };

  if (typeof actions === 'function') {
    handleAction(actions.key, actions);
  } else {
    Object.keys(actions).forEach((key) => handleAction(key, actions[key]));
  }

  return (state = initialState, action: DecoratedFunction) => {
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

export function compose(func: DecoratedFunction) {
  if (func && typeof func === 'function') {
    // eslint-disable-next-line no-param-reassign
    func.isCompose = true;
    return func;
  }
  return (
    target: Function,
    name: string,
    descriptor: TypedPropertyDescriptor<any>
  ) => {
    // eslint-disable-next-line no-param-reassign
    descriptor.value.isCompose = true;
    return descriptor;
  };
}

export function async(func: DecoratedFunction) {
  if (func && typeof func === 'function') {
    // eslint-disable-next-line no-param-reassign
    func.isAsync = true;
    return func;
  }
  return (
    target: Function,
    name: string,
    descriptor: TypedPropertyDescriptor<any>
  ) => {
    // eslint-disable-next-line no-param-reassign
    descriptor.value.isAsync = true;
    return descriptor;
  };
}

export function pure(func: DecoratedFunction) {
  if (func && typeof func === 'function') {
    // eslint-disable-next-line no-param-reassign
    func.isPure = true;
    return func;
  }
  return (
    target: Function,
    name: string,
    descriptor: TypedPropertyDescriptor<any>
  ) => {
    // eslint-disable-next-line no-param-reassign
    descriptor.value.isPure = true;
    return descriptor;
  };
}
