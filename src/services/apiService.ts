/**
 * Centralized API Service
 *
 * This service handles all API communications with the Hostaway Assessment API
 * and provides a consistent interface for Redux slices.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {env} from '../config/env';

// Storage keys
const AUTH_TOKEN_KEY = 'hostaway_auth_token';
const REFRESH_TOKEN_KEY = 'hostaway_refresh_token';
const USER_DATA_KEY = 'hostaway_user_data';

// API endpoints
const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/api/auth/login',
    REGISTER: '/api/auth/register',
    LOGOUT: '/api/auth/logout',
    REFRESH: '/api/auth/refresh',
  },
  WEATHER: {
    CURRENT: '/api/weather/current',
    SEARCH: '/api/weather/search',
    HISTORY: '/api/weather/history',
  },
  PROFILE: '/api/profile',
  HEALTH: '/api/health',
};

// Type definitions
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  preferences?: {
    temperatureUnit: 'celsius' | 'fahrenheit';
    theme: 'light' | 'dark' | 'system';
    notifications: boolean;
  };
}

export interface AuthResponse {
  success: boolean;
  user: User;
  token: string;
  refreshToken?: string;
}

export interface WeatherData {
  location: string;
  temperature: number;
  description: string;
  humidity: number;
  windSpeed: number;
  timestamp: string;
}

export interface WeatherSearchResult {
  location: {
    name: string;
    country: string;
    lat: number;
    lon: number;
  };
  weatherData: {
    temperature: number;
    description: string;
    humidity: number;
    windSpeed: number;
    icon: string;
  };
  createdAt: string;
}

export interface WeatherHistoryItem {
  _id: string;
  userId: string;
  query: string;
  location: {
    name: string;
    country: string;
    lat: number;
    lon: number;
  };
  weatherData: {
    temperature: number;
    description: string;
    humidity: number;
    windSpeed: number;
    icon: string;
  };
  createdAt: string;
  updatedAt: string;
  __v: number;
}

export interface ApiError {
  error: string;
  message: string;
  statusCode?: number;
}

class ApiService {
  private baseUrl: string;
  private token: string | null = null;

  constructor() {
    this.baseUrl = env.api.baseUrl;
  }

  // Initialize service
  async initialize(): Promise<void> {
    this.token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
  }

  // Set auth token
  setToken(token: string): void {
    this.token = token;
  }

  // Clear auth token
  clearToken(): void {
    this.token = null;
  }

  // Get current token
  getToken(): string | null {
    return this.token;
  }

  // Build request headers
  private getHeaders(includeAuth: boolean = true): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    if (includeAuth && this.token) {
      // Use JWT token for authenticated requests
      headers.Authorization = `Bearer ${this.token}`;
    }

    return headers;
  }

  // Generic request method
  private async request<T>(
    endpoint: string,
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
      body?: any;
      includeAuth?: boolean;
    } = {},
  ): Promise<T> {
    const {method = 'GET', body, includeAuth = true} = options;

    const url = `${this.baseUrl}${endpoint}`;
    const headers = this.getHeaders(includeAuth);

    const config: RequestInit = {
      method,
      headers,
    };

    if (body && method !== 'GET') {
      config.body = JSON.stringify(body);
    }

    console.log(`API Request: ${method} ${url}`);
    console.log('Headers:', headers);
    if (body) {
      console.log('Body:', body);
    }

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      console.log(`API Response: ${response.status}`, data);

      if (!response.ok) {
        const error: ApiError = {
          error: data.error || 'Request failed',
          message: data.message || `HTTP ${response.status}`,
          statusCode: response.status,
        };
        throw error;
      }

      return data;
    } catch (error) {
      console.error('API Request failed:', error);
      throw error;
    }
  }

  // Authentication methods
  async login(credentials: AuthCredentials): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>(
      API_ENDPOINTS.AUTH.LOGIN,
      {
        method: 'POST',
        body: credentials,
        includeAuth: false,
      },
    );

    // Store tokens
    if (response.token) {
      this.token = response.token;
      await AsyncStorage.setItem(AUTH_TOKEN_KEY, response.token);

      if (response.refreshToken) {
        await AsyncStorage.setItem(REFRESH_TOKEN_KEY, response.refreshToken);
      }

      await AsyncStorage.setItem(USER_DATA_KEY, JSON.stringify(response.user));
    }

    return response;
  }

  async register(userData: RegisterData): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>(
      API_ENDPOINTS.AUTH.REGISTER,
      {
        method: 'POST',
        body: userData,
        includeAuth: false,
      },
    );

    // Store tokens
    if (response.token) {
      this.token = response.token;
      await AsyncStorage.setItem(AUTH_TOKEN_KEY, response.token);

      if (response.refreshToken) {
        await AsyncStorage.setItem(REFRESH_TOKEN_KEY, response.refreshToken);
      }

      await AsyncStorage.setItem(USER_DATA_KEY, JSON.stringify(response.user));
    }

    return response;
  }

  async logout(): Promise<void> {
    try {
      // Call logout endpoint if available
      await this.request(API_ENDPOINTS.AUTH.LOGOUT, {
        method: 'POST',
      });
    } catch (error) {
      console.warn('Logout endpoint failed:', error);
    }

    // Clear stored tokens
    this.token = null;
    await AsyncStorage.multiRemove([
      AUTH_TOKEN_KEY,
      REFRESH_TOKEN_KEY,
      USER_DATA_KEY,
    ]);
  }

  async refreshToken(): Promise<string> {
    const refreshToken = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await this.request<{token: string}>(
      API_ENDPOINTS.AUTH.REFRESH,
      {
        method: 'POST',
        body: {refreshToken},
        includeAuth: false,
      },
    );

    // Update stored token
    this.token = response.token;
    await AsyncStorage.setItem(AUTH_TOKEN_KEY, response.token);

    return response.token;
  }

  // Weather methods
  async getCurrentWeather(city: string): Promise<WeatherData> {
    const response = await this.request<{success: boolean; data: WeatherData}>(
      `${API_ENDPOINTS.WEATHER.CURRENT}?city=${encodeURIComponent(city)}`,
    );
    return response.data;
  }

  async searchWeather(location: string): Promise<WeatherSearchResult> {
    // Since /api/weather/search doesn't exist, use current weather as fallback
    const response = await this.request<{success: boolean; data: WeatherData}>(
      `${API_ENDPOINTS.WEATHER.CURRENT}?city=${encodeURIComponent(location)}`,
    );

    // Transform response to match expected SearchResult format
    return {
      location: {
        name: response.data.location,
        country: 'Unknown', // API doesn't provide country in current weather
        lat: 0, // API doesn't provide coordinates
        lon: 0,
      },
      weatherData: {
        temperature: response.data.temperature,
        description: response.data.description,
        humidity: response.data.humidity,
        windSpeed: response.data.windSpeed,
        icon: 'default',
      },
      createdAt: response.data.timestamp,
    };
  }

  async getWeatherHistory(): Promise<WeatherHistoryItem[]> {
    const response = await this.request<{
      success: boolean;
      data: WeatherHistoryItem[];
    }>(API_ENDPOINTS.WEATHER.HISTORY);
    return response.data;
  }

  // Profile methods
  async getUserProfile(): Promise<User> {
    return this.request<User>(API_ENDPOINTS.PROFILE);
  }

  async updateUserProfile(updates: Partial<User>): Promise<User> {
    return this.request<User>(API_ENDPOINTS.PROFILE, {
      method: 'PUT',
      body: updates,
    });
  }

  // Health check
  async healthCheck(): Promise<{status: string; timestamp: string}> {
    return this.request<{status: string; timestamp: string}>(
      API_ENDPOINTS.HEALTH,
      {includeAuth: false},
    );
  }

  // Token management
  async isAuthenticated(): Promise<boolean> {
    if (!this.token) {
      await this.initialize();
    }
    return this.token !== null;
  }

  async getStoredUser(): Promise<User | null> {
    try {
      const userData = await AsyncStorage.getItem(USER_DATA_KEY);
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      console.error('Error loading stored user:', error);
      return null;
    }
  }

  // Store user data
  async storeUser(user: User): Promise<void> {
    try {
      await AsyncStorage.setItem(USER_DATA_KEY, JSON.stringify(user));
    } catch (error) {
      console.error('Error storing user:', error);
    }
  }
}

// Export singleton instance
export const apiService = new ApiService();
export default apiService;
