const mongoose = require("mongoose");
const express = require("express");
const bodyParser = require("body-parser");
const expressRateLimit = require("express-rate-limit");
const cors = require('cors');

require("dotenv/config");

// Setup server
const server = express();
server.enable('trust proxy');

// Rate limiters: 1 request per second, enough for most genuine API calls.
const rateLimiterIP = expressRateLimit({
    windowMs: 1000 * 60,
    max: 60
});

// Middleware
server.use(cors());
server.use(rateLimiterIP);
server.use(bodyParser.json({limit: "2mb"}));
server.use((err, _req, res, next) => {
    if (!err) { return next(); }
    if (err.expose) { return res.status(err.status).send(err.type); }

    next(err);
});

// Routes
server.use("/account", require("./routes/account"));
server.use("/blueprint", require("./routes/blueprint"));
server.use("/collection", require("./routes/collection"));

// Connect to database
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
},

() => {
    console.log("Connected to database!");

    server.listen(process.env.PORT || 8080, () => {
        console.log("API started. Listening on port " + (process.env.PORT || 8080) + ".");
    });
});
