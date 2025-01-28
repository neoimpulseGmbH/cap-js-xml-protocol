# CDS XMLAdapter Plugin

This plugin for the SAP Cloud Application Programming Model (CAP) extends the default REST adapter to support XML payloads. It parses incoming XML data, converts it to JSON, and ensures compatibility with CAP's processing logic.

## Features

-   Parses incoming XML payloads into JSON.
-   Converts `Content-Type` from `application/xml` to `application/json` for CAP compatibility.
-   Removes XML namespaces and attributes to create a clean JSON structure.
-   Converts boolean values correctly (`"true"` → `true`, `"false"` → `false`).
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
    <ExchangeRate>
        <ID>123</ID>
        <Rate>10.5</Rate>
        <FromCurrency>EUR</FromCurrency>
        <ToCurrency>USD</ToCurrency>
        <IsValid>true</IsValid>
    </ExchangeRate>
    ```

3. **Handle XML Data in CAP**

    The plugin automatically converts the XML to JSON, which can be processed by your CAP service logic.

## How It Works

The plugin integrates with CAP's middleware pipeline and processes incoming requests as follows:

1. Checks if the `Content-Type` is `application/xml`.
2. Parses the XML payload into JSON using `xml2js`.
3. Removes XML namespaces and attributes.
4. Converts boolean values (`"true"` → `true`, `"false"` → `false`).
5. Updates the `Content-Type` to `application/json` for compatibility with CAP services.
6. Passes the parsed data to the next middleware in the chain.

If the `Content-Type` is not `application/xml`, it returns a `415 Unsupported Media Type` error. For invalid XML payloads, it returns a `400 Bad Request` error.

```javascript
const cds = require("@sap/cds");
const { parseStringPromise } = require("xml2js");
const HttpAdapter = require("@sap/cds/lib/srv/protocols/http");

class XMLAdapter extends HttpAdapter {
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
                        const jsonBody = await parseStringPromise(xmlBody, {
                            explicitArray: false,
                            ignoreAttrs: true,
                            tagNameProcessors: [(name) => name.replace(/^.*:/, "")],
                            valueProcessors: [
                                (value) => {
                                    if (value === "true") return true;
                                    if (value === "false") return false;
                                    return value;
                                },
                            ]
                        });

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
