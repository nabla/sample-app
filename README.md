This code is a simple web application that integrates the [Nabla Core API](https://docs.nabla.com).

To test it on your machine:
- First you need to configure on OAuth client. To do so, go to the [Core API admin console](https://pro.nabla.com/copilot-api-signup) and create an OAuth Client in OAuth Clients section.
- Then, at the beginning of the **main.js** file, fill in the following variables:
  - `OAUTH_CLIENT_UUID`: The UUID of your OAuth client. You can obtain it via the "copy OAuth client ID" option in the admin console.
  - `OAUTH_CLIENT_PRIVATE_KEY`: The private key associated to the public key you provided for your OAuth client.
  - `REGION`: Your Nabla region, "us" or "eu".
- Finally, you just need to run an HTTP static server.
  For instance, if Node.js is installed on your machine, you can run `npx http-server .` and open http://127.0.0.1:8080/

To find more information, check out our [documentation](https://docs.nabla.com), especially the [section about authentication](https://docs.nabla.com/guides/authentication).
