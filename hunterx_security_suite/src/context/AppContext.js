import React, { createContext, useReducer, useContext } from "react";

// Initial app state
const initialState = {
  darkMode: true,
  activeTab: "recon",
  // Place for future states: user, plugins, notifications, etc.
};

// Action types
const SET_TAB = "SET_TAB";
const TOGGLE_DARK_MODE = "TOGGLE_DARK_MODE";

// Reducer (expandable)
function appReducer(state, action) {
  switch (action.type) {
    case SET_TAB:
      return { ...state, activeTab: action.tab };
    case TOGGLE_DARK_MODE:
      return { ...state, darkMode: !state.darkMode };
    default:
      return state;
  }
}

// Context setup
const AppContext = createContext();
const AppDispatchContext = createContext();

// PUBLIC_INTERFACE
export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  return (
    <AppContext.Provider value={state}>
      <AppDispatchContext.Provider value={dispatch}>
        {children}
      </AppDispatchContext.Provider>
    </AppContext.Provider>
  );
}

// PUBLIC_INTERFACE
export function useAppState() {
  return useContext(AppContext);
}

// PUBLIC_INTERFACE
export function useAppDispatch() {
  return useContext(AppDispatchContext);
}
