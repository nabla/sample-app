This code is a simple web application that integrates the [Nabla API](https://www.nabla.com/). 

To test it on your machine:
- First you need an API key. To get one, go to the [Console to create an organization](https://pro.nabla.com/copilot-api-signup) and create a Server API Key in API Keys.
- Replace the placeholder in `main.js` line 1 with your key. 
- Then, you just need to run a http static server.  

For instance, if Node.js is installed on your machine, you can run:
```shell
npx http-server .
```
and browse http://127.0.0.1:8080/

You'll find more information about Nabla APIs on our [documentation](https://docs.nabla.com/reference/copilot-listen)
