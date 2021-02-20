interface BaseActionHandler {
  isCompose?: boolean;
  isAsync?: boolean;
  isPure?: boolean;
}

interface ActionHandler extends BaseActionHandler {
  (...args: any[]): void | Thunk | {};
}

interface Action {
  type: string;
  payload: State;
}

interface Reducer {
  (state: Record<string, State>, action: Action): State;
}

interface State {
  loading?: boolean;
  loaded?: boolean;
  data?: any;
  error?: any;
}

interface Thunk {
  (
    dispatch: (action: ActionHandler | Action) => void,
    getState: () => Record<string, any>
  ): Promise<any>;
}

interface DecoratedAction extends BaseActionHandler {
  (...args: any[]): Thunk;
  key: string;
  type: string;
  types: string[];
  begin: string;
  success: string;
  failed: string;
}

enum ActionType {
  BEGIN = 'BEGIN',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

export function createAction(key: string, handler: ActionHandler) {
  const actionId = `${key.toUpperCase()}`;
  const actionTypes = [
    ActionType.BEGIN,
    ActionType.SUCCESS,
    ActionType.FAILED,
  ].map((type) => `${actionId}_${type}`);
  const [begin, success, failed] = actionTypes;

  const { isAsync, isPure, isCompose } = handler;
  const action: DecoratedAction = (...args: any[]) => async (
    dispatch,
    getState
  ) => {
    if (isAsync) {
      dispatch({
        type: begin,
        payload: { loaded: false, loading: true, data: undefined },
      });
    }

    try {
      let result: Function | any = await handler(...args);
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
      return result;
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
      return Promise.reject(error);
    }
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

export function createActions(
  prefix: string,
  actions: Record<string, ActionHandler>
) {
  return Object.keys(actions).reduce(
    (accumulator: { [key in keyof typeof actions]: DecoratedAction }, key) => {
      const actionId = `${prefix.toUpperCase()}__${key
        .replace(/[A-Z]/g, '-$&')
        .toUpperCase()}`;

      const action = createAction(actionId, actions[key]);
      action.key = key;

      return {
        ...accumulator,
        [key]: action,
      };
    },
    {}
  );
}

export function handleActions(
  actions: Record<string, DecoratedAction> | DecoratedAction,
  reducers: Record<string, Reducer> = {},
  initialState: { [key: string]: any } = {}
) {
  const isFunction = typeof actions === 'function';
  let actionTypes: string[] = [];

  const handleInitialState = (key: string, payload: Record<string, any> = {}) =>
    isFunction
      ? payload
      : {
        ...initialState,
        [key]: payload,
      };

  const handleState = (
    key: string,
    state: Record<string, any> = {},
    payload: Record<string, any> = {}
  ) =>
    isFunction
      ? payload
      : {
        ...state,
        [key]: payload,
      };
  const handleAction = (key: string, action: DecoratedAction) => {
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
        initialState = handleInitialState(key, {
          loaded: false,
          loading: false,
          data: undefined,
        });
      }

      if (isPure) {
        initialState = handleInitialState(key, {});
      }
    }

    /**
     * Create default reducers
     */
    if (isAsync) {
      types.forEach((t) => {
        if (!reducers[t]) {
          reducers[t] = (state, { payload }) =>
            handleState(key, state, {
              ...payload,
              loaded:
                (isFunction ? state.loaded : state[key]?.loaded) ||
                payload?.loaded,
            });
        }
      });
    }

    if (isPure && !reducers[type]) {
      reducers[type] = (state, { payload }) => handleState(key, state, payload);
    }
  };

  if (typeof actions === 'function') {
    handleAction(actions.key, actions);
  } else {
    Object.keys(actions).forEach((key) => handleAction(key, actions[key]));
  }

  return (state = initialState, action: Action) => {
    let reducer;
    if (actionTypes.includes(action.type)) {
      reducer = reducers[action.type];
    }

    if (reducer) {
      return reducer(state, action);
    }
    return state;
  };
}

function decorator(func: ActionHandler, key: keyof ActionHandler) {
  if (func && typeof func === 'function') {
    func[key] = true;
    return func;
  }
  return (
    target: ActionHandler,
    name: string,
    descriptor: TypedPropertyDescriptor<
      { [key in keyof BaseActionHandler]: boolean }
      >
  ) => ({ ...descriptor, value: { [key]: true } });
}

export const compose = (action: ActionHandler) =>
  decorator(action, 'isCompose');
export const async = (action: ActionHandler) => decorator(action, 'isAsync');
export const pure = (action: ActionHandler) => decorator(action, 'isPure');
