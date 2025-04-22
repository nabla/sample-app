import { API_VERSION } from "./commonUtils.js";

const INITIAL_USER_ACCESS_TOKEN = "<YOUR_INITIAL_USER_ACCESS_TOKEN>"
const INITIAL_USER_REFRESH_TOKEN = "<YOUR_INITIAL_USER_REFRESH_TOKEN>"
const REGION = "<YOUR_REGION>" // "us" or "eu"

let userAccessToken = INITIAL_USER_ACCESS_TOKEN;
let userRefreshToken = INITIAL_USER_REFRESH_TOKEN;

const CORE_API_BASE_URL = `${REGION}.api.nabla.com/v1/core`;

const showTokenError = (message) => {
    const errorDiv = document.getElementById("token-error");
    if (!errorDiv) return;
    errorDiv.innerHTML = message;
    errorDiv.classList.remove("hide");
};

const decodeJWT = (token) => {
    const parts = token.split('.');
    if (parts.length !== 3) {
        showTokenError("The user tokens seem invalid. You maybe forgot to provide initial tokens in the source code.");
        throw new Error("Invalid JWT token");
    }
    const payload = parts[1];
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))); // replace URL-safe characters
};

const isTokenExpiredOrExpiringSoon = (token) => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    return (decodeJWT(token).exp - nowSeconds) < 5;
};

const setUserTokens = (newAccessToken, newRefreshToken) => {
    userAccessToken = newAccessToken;
    userRefreshToken = newRefreshToken;
};

const getOrRefetchUserAccessToken = async () => {
    if (!isTokenExpiredOrExpiringSoon(userAccessToken)) {
        return userAccessToken;
    }

    if (isTokenExpiredOrExpiringSoon(userRefreshToken)) {
        showTokenError("Your user refresh token has expired. Please provide new initial tokens in the source code.");
        throw new Error("Refresh token expired");
    }

    const refreshResponse = await fetch(`https://${CORE_API_BASE_URL}/user/jwt/refresh`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Nabla-Api-Version': API_VERSION
        },
        body: JSON.stringify({ refresh_token: userRefreshToken }),
    });
    
    if (!refreshResponse.ok) {
        showTokenError("The user access token refresh failed. Please try to provide new initial tokens in the source code.");
        throw new Error(`Refresh call failed (status: ${refreshResponse.status})`);
    }

    const data = await refreshResponse.json();
    setUserTokens(data.access_token, data.refresh_token);
    return userAccessToken;
};

export {
    CORE_API_BASE_URL,
    getOrRefetchUserAccessToken
}; 
