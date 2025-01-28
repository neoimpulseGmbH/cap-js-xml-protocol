
# CDS XMLAdapter Plugin

This plugin for the SAP Cloud Application Programming Model (CAP) adds support for XML payloads by extending the default REST adapter. It parses incoming XML payloads, converts them to JSON, and ensures compatibility with CAP's processing logic.

## Features

-   Automatically parses incoming XML payloads to JSON.
-   Converts `Content-Type` from `application/xml` to `application/json` for CAP compatibility.
-   Returns appropriate error messages for invalid XML or unsupported content types.

## Installation

To install the plugin, add it to your CAP project.

```sh
npm install cds-xmladapter-plugin
```

## Usage

1. **Add the XMLAdapter to Your CAP Project**

    Extend your CAP server to use the `XMLAdapter`.

    ```javascript
    const cds = require("@sap/cds");
    const XMLAdapter = require("cds-xmladapter-plugin");

    cds.on("bootstrap", (app) => {
        app.use(new XMLAdapter().router);
    });

    module.exports = cds.server;
    ```

2. **Send XML Requests**

    Use tools like Postman or custom clients to send requests with XML payloads. Ensure the `Content-Type` header is set to `application/xml`.

    Example XML payload:
    ```xml
    <Book>
        <ID>1</ID>
        <title>XML for CAP</title>
        <author>John Doe</author>
    </Book>
    ```

3. **Handle XML Data in CAP**

    The plugin automatically converts the XML to JSON, which can be processed by your CAP service logic as usual.

## How It Works

The plugin hooks into CAP's middleware pipeline and processes incoming requests as follows:

1. Checks if the `Content-Type` is `application/xml`.
2. Parses the XML payload into JSON using `xml2js`.
3. Updates the `Content-Type` to `application/json` for compatibility with CAP services.
4. Passes the parsed data to the next middleware in the chain.

If the `Content-Type` is not `application/xml`, it returns a `415 Unsupported Media Type` error. For invalid XML payloads, it returns a `400 Bad Request` error.

```javascript
const cds = require("@sap/cds");
const { parseStringPromise } = require("xml2js");
const { RestAdapter } = require("@sap/cds/libx/rest/RestAdapter");

class XMLAdapter extends RestAdapter {
    get router() {
        const router = super.router;

        router.use((req, res, next) => {
            if (req.method in { POST: 1, PUT: 1, PATCH: 1 } && req.headers["content-type"]) {
                if (!req.headers["content-type"].includes("application/xml")) {
                    res.status(415).json({ error: "Invalid content type. Expected 'application/xml'." });
                    return;
                }
            }
            next();
        });

        router.use((req, res, next) => {
            if (req.headers["content-type"] && req.headers["content-type"].includes("application/xml")) {
                let xmlBody = "";
                req.on("data", (chunk) => {
                    xmlBody += chunk.toString();
                });

                req.on("end", async () => {
                    try {
                        const jsonBody = await parseStringPromise(xmlBody, { explicitArray: false });
                        req.body = jsonBody;
                        req.headers["content-type"] = "application/json";
                        next();
                    } catch (err) {
                        res.status(400).json({ error: "Invalid XML format." });
                    }
                });
            } else {
                next();
            }
        });

        return router;
    }
}

module.exports = XMLAdapter;
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Acknowledgments

Thanks to the SAP CAP community for their support and contributions.
