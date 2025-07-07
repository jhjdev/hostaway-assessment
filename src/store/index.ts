import { configureStore } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { persistStore, persistReducer, FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER } from 'redux-persist';
import { createLogger } from 'redux-logger';

import themeReducer, { ThemeState } from './slices/themeSlice';
import weatherReducer from './slices/weatherSlice';
import searchReducer from './slices/searchSlice';
import authReducer from './slices/authSlice';

const themePersistConfig = {
  key: 'theme',
  storage: AsyncStorage,
  whitelist: ['mode'], // Only persist the theme mode
};

const searchPersistConfig = {
  key: 'search',
  storage: AsyncStorage,
  whitelist: ['searchHistory'], // Only persist the search history
};

// Auth persist config
const authPersistConfig = {
  key: 'auth',
  storage: AsyncStorage,
  whitelist: ['user', 'token', 'refreshToken', 'isAuthenticated'], // Persist auth state
};

// Define the root reducer with proper typing
const rootReducer = {
  theme: persistReducer<ThemeState>(themePersistConfig, themeReducer),
  weather: weatherReducer,
  search: persistReducer(searchPersistConfig, searchReducer),
  auth: persistReducer(authPersistConfig, authReducer),
};

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }).concat(createLogger({
      collapsed: true,
      diff: true,
    })),
});

export const persistor = persistStore(store);

// Enhanced RootState type that includes PersistPartial for the theme slice
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
