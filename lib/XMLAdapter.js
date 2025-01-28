const cds = require("@sap/cds");
const { parseStringPromise } = require("xml2js");
const { RestAdapter } = require("@sap/cds/libx/rest/RestAdapter");

class XMLAdapter extends RestAdapter {
  constructor(...args) {
    super(...args);
  }

  get router() {
    const router = super.router;

    router.use((req, res, next) => {
      if (
        req.method in { POST: 1, PUT: 1, PATCH: 1 } &&
        req.headers["content-type"] &&
        !req.headers["content-type"].includes("application/xml")
      ) {
        res.status(415).json({ error: "Invalid content type. Expected 'application/xml'." });
        return;
      }
      next();
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
