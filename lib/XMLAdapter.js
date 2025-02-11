const cds = require("@sap/cds");
const { parseStringPromise } = require("xml2js");

const parse = require("@sap/cds/libx/rest/middleware/parse");
const create = require("@sap/cds/libx/rest/middleware/create");
const read = require("@sap/cds/libx/rest/middleware/read");
const update = require("@sap/cds/libx/rest/middleware/update");
const deleet = require("@sap/cds/libx/rest/middleware/delete");
const operation = require("@sap/cds/libx/rest/middleware/operation");
const error = require("@sap/cds/libx/rest/middleware/error");

const { bufferToBase64 } = require("@sap/cds/libx/_runtime/common/utils/binary");

const HttpAdapter = require("@sap/cds/lib/srv/protocols/http");
const bodyParser4 = require("@sap/cds/libx/odata/middleware/body-parser");

const { NoaRequest } = require("@sap/cds/libx/odata/ODataAdapter");
class RestRequest extends NoaRequest {
    get protocol() {
        return "xml";
    }
}

class XMLAdapter extends HttpAdapter {
    request4(args) {
        return new RestRequest(args);
    }

    get router() {
        const srv = this.service;
        const router = super.router;

        const jsonBodyParser = bodyParser4(this);

        router.head("/", (_, res) => res.json({}));
        const entities = Object.keys(srv.entities).map((e) => ({ name: e, url: e }));
        router.get("/", (_, res) => res.json({ entities }));

        router.use((req, res, next) => {
            if (req.method in { POST: 1, PUT: 1, PATCH: 1 } && req.headers["content-type"]) {
                const parts = req.headers["content-type"].split(";");
                if (!parts[0].match(/^application\/xml$/) || parts[1] === "") {
                    throw cds.error("INVALID_CONTENT_TYPE_ONLY_XML", { statusCode: 415, code: "415" });
                }
            }
            if (req.method in { PUT: 1, PATCH: 1 }) {
                if (req.headers["content-length"] === "0") {
                    res.status(400).json({ error: { message: "Malformed document", statusCode: 400, code: "400" } });
                    return;
                }
            }

            return next();
        });

        router.use(async (req, res, next) => {
            if (
                req.method in { POST: 1, PUT: 1, PATCH: 1 } &&
                req.headers["content-type"] &&
                req.headers["content-type"].includes("application/xml")
            ) {
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
                                }
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

        router.use((req, res, next) => {
            if (req.method in { POST: 1, PUT: 1, PATCH: 1 } && req.headers["content-type"]) {
                const parts = req.headers["content-type"].split(";");
                if (!parts[0].match(/^application\/json$/) || parts[1] === "") {
                    throw cds.error("INVALID_CONTENT_TYPE_ONLY_JSON", { statusCode: 415, code: "415" });
                }
            }
            if (req.method in { PUT: 1, PATCH: 1 }) {
                if (req.headers["content-length"] === "0") {
                    res.status(400).json({ error: { message: "Malformed document", statusCode: 400, code: "400" } });
                    return;
                }
            }

            return next();
        });
        router.use(jsonBodyParser);
        router.use(parse(this));

        const operation_middleware = operation(this);
        const create_middleware = create(this);
        const read_middleware = read(this);
        const update_middleware = update(this);
        const delete_middleware = deleet(this);
        router.use(async function dispatch(req, res, next) {
            try {
                let result, status, location;

                if (req._operation) {
                    ({ result, status } = await operation_middleware(req, res));
                } else {
                    switch (req.method) {
                        case "POST":
                            ({ result, status, location } = await create_middleware(req, res));
                            break;
                        case "HEAD":
                        case "GET":
                            ({ result, status } = await read_middleware(req, res));
                            break;
                        case "PUT":
                        case "PATCH":
                            const _res = await update_middleware(req, res, next);
                            if (_res) ({ result, status } = _res);
                            break;
                        case "DELETE":
                            ({ result, status } = await delete_middleware(req, res));
                            break;
                    }
                }

                if (status || result !== undefined) {
                    req._result = { result, status, location };
                    return next();
                }
            } catch (e) {
                next(e);
            }
        });

        router.use((req, res) => {
            const { result, status, location } = req._result;

            if (res.headersSent) return;

            let definition = req._operation || req._query.__target;
            if (typeof definition === "string")
                definition =
                    srv.model.definitions[definition] ||
                    srv.model.definitions[definition.split(":$:")[0]].actions[definition.split(":$:")[1]];
            if (result && srv && definition) bufferToBase64(result, srv, definition);

            if (status && res.statusCode === 200) res.status(status);
            if (location && !res.getHeader("location")) res.set("location", location);

            if (req.method === "HEAD")
                res.type("json")
                    .set({ "content-length": JSON.stringify(result).length })
                    .end();
            else res.send(typeof result === "number" ? result.toString() : result);
        });

        if (cds.env.features.rest_error_handler !== false) router.use(error(this));

        return router;
    }
}

module.exports = XMLAdapter;
