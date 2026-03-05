import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from "axios";
import { API_BASE_URL, API_KEY_HEADER, DEFAULT_REQUEST_TIMEOUT_MS } from "../constants.js";

export interface APIClientOptions {
  apiKey: string;
  baseURL?: string;
  timeoutMs?: number;
}

export class ZafariAPIClient {
  private client: AxiosInstance;

  constructor(options: APIClientOptions) {
    this.client = axios.create({
      baseURL: options.baseURL ?? API_BASE_URL,
      headers: {
        [API_KEY_HEADER]: options.apiKey,
        "Content-Type": "application/json",
      },
      timeout: options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS,
    });
  }

  /**
   * Make a GET request to the Zafari API
   */
  async get<T>(endpoint: string, params?: Record<string, unknown>): Promise<T> {
    try {
      const config: AxiosRequestConfig = { params };
      const response = await this.client.get<T>(endpoint, config);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Make a POST request to the Zafari API
   */
  async post<T>(endpoint: string, data?: unknown): Promise<T> {
    try {
      const response = await this.client.post<T>(endpoint, data);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Make a PUT request to the Zafari API
   */
  async put<T>(endpoint: string, data?: unknown): Promise<T> {
    try {
      const response = await this.client.put<T>(endpoint, data);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Make a DELETE request to the Zafari API
   */
  async delete<T>(endpoint: string): Promise<T> {
    try {
      const response = await this.client.delete<T>(endpoint);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Handle and format API errors
   */
  private handleError(error: unknown): Error {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{ error?: string; message?: string }>;
      
      if (axiosError.response) {
        const status = axiosError.response.status;
        const data = axiosError.response.data;
        const errorMessage = data?.error || data?.message || axiosError.message;

        switch (status) {
          case 400:
            return new Error(`Bad Request: ${errorMessage}`);
          case 401:
            return new Error("Authentication failed. Please check your API key.");
          case 403:
            return new Error("Access forbidden. You don't have permission to access this resource.");
          case 404:
            return new Error(`Resource not found: ${errorMessage}`);
          case 429:
            return new Error("Rate limit exceeded. Please try again later.");
          case 500:
            return new Error(`Server error: ${errorMessage}`);
          default:
            return new Error(`API error (${status}): ${errorMessage}`);
        }
      } else if (axiosError.request) {
        return new Error("Network error: Unable to reach Zafari API. Please check your connection.");
      }
    }
    
    return new Error(`Unexpected error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export interface ResolvedAPIClientOptions {
  apiKey?: string;
  baseURL?: string;
  timeoutMs?: number;
}

export function createAPIClient(options: ResolvedAPIClientOptions = {}): ZafariAPIClient {
  const apiKey = options.apiKey ?? process.env.ZAFARI_API_KEY;
  if (!apiKey) {
    throw new Error("ZAFARI_API_KEY environment variable is required");
  }

  return new ZafariAPIClient({
    apiKey,
    baseURL: options.baseURL ?? process.env.ZAFARI_BASE_URL ?? API_BASE_URL,
    timeoutMs: options.timeoutMs,
  });
}
