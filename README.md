The code of the `app` directory is a simple web application that demonstrates the capabilities of the [Nabla Core API](https://docs.nabla.com) (version `2025-04-03`).

![Sample app screenshot](static/sample_app_screenshot.png)

To test it on your machine:
- First you need to configure an OAuth client. To do so:
  - Go to the Core API admin console to [sign-up](https://pro.nabla.com/core-api-signup) or [log in](https://pro.nabla.com/login).
  - Create an OAuth Client in OAuth Clients section.
- Then, you need to use this OAuth client to generate initial user access and refresh tokens for the app. In a realistic architecture, this work would be done by a dedicated authentication backend server on your side. For simplicity's sake, however, we provide a `scripts/initialTokensGenerator.js` node script that imitates a backend server that would create and authenticate a Core API user. To use it: 
  - at the beginning of the script, fill in the following variables:
    - `OAUTH_CLIENT_UUID`: The UUID of your OAuth client. You can obtain it via the "copy OAuth client ID" option in the admin console.
    - `OAUTH_CLIENT_PRIVATE_KEY`: The private key associated to the public key you provided for your OAuth client.
    - `REGION`: The geographical region of your Nabla Core API organization, as selected during sign-up, will be either `us` or `eu`.
  - Then run in your terminal: `node scripts/initialTokensGenerator.js`
    - _(With Node >= 18)_
  - If all goes well, the script will write generated initial user access and refresh tokens in a `userTokens.json` file
- Then, you need to fill in the initial tokens and region configs in `app/shared/authentication.js` file:
  - `INITIAL_USER_ACCESS_TOKEN`: The initial user access token, obtained via the script or an external source.
  - `INITIAL_USER_REFRESH_TOKEN`: The initial user refresh token, obtained similarly.
  - `REGION`: The geographical region of your Nabla Core API organization, as selected during sign-up, will be either `us` or `eu`.
- Finally, you just need to run an HTTP static server to access the app.
  For instance, if Node.js is installed on your machine, you can run `npx http-server app/` and open http://127.0.0.1:8080/

To find more information, check out our [documentation](https://docs.nabla.com), especially the [section about authentication](https://docs.nabla.com/guides/authentication).
