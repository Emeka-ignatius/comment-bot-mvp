export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Generate login URL - simple login page
export const getLoginUrl = () => {
  return "/login";
};

// API base URL for auth endpoints
export const getApiUrl = (path: string) => {
  const baseUrl = import.meta.env.VITE_BACKEND_URL || window.location.origin;
  return `${baseUrl}${path}`;
};
