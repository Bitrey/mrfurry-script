const axios = require("axios");
const express = require("express");
const cheerio = require("cheerio");
const logger = require("./logger");
require("dotenv").config();

const app = express();

const amazonUrl =
    "https://www.amazon.it/Gigabyte-GeForce-RTX-3070-GAMING/dp/B08KHL21CV/";
const alertNum = 700;

const getPrice = () => {
    return new Promise(async (resolve, reject) => {
        try {
            const { data } = await axios.get(amazonUrl, {
                headers: {
                    "User-Agent":
                        "Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2228.0 Safari/537.36"
                }
            });
            logger.debug("richiesta ok");
            const $ = cheerio.load(data);
            const text = $(".a-color-price").html();
            if (typeof text !== "string") {
                return resolve(null);
            }
            const price = parseFloat(
                text.replace("&nbsp;€", "").replace(".", "").replace(",", ".")
            );
            resolve(typeof price === "number" ? price : null);
        } catch (err) {
            logger.debug("richiesta errore");
            reject(err);
        }
    });
};

const isBelowMinimum = currentPrice => {
    return new Promise(async (resolve, reject) => {
        try {
            if (currentPrice) return resolve(currentPrice < alertNum);
            else {
                const price = await getPrice();
                resolve(price < alertNum);
            }
        } catch (err) {
            reject(err);
        }
    });
};

app.use(express.static("public"));

app.all("*", (req, res) => {
    res.sendFile(__dirname + "/index.html");
});

const PORT = Number(process.env.PORT) || 3000;
const IP = process.env.IP || "127.0.0.1";
const server = app.listen(PORT, IP, () => {
    logger.info(`Mr furry server started on ${IP}:${PORT}`);
});

const io = require("socket.io")(server);
io.on("connection", async socket => {
    socket.on("data", async () => {
        try {
            const currentPrice = await getPrice();
            const isBelowMin = await isBelowMinimum(currentPrice);
            const date = new Date();
            socket.emit("data", {
                amazonUrl,
                currentPrice,
                alertNum,
                isBelowMin,
                date
            });
        } catch (err) {
            socket.emit("error", err);
        }
    });
});

// const fetchAmazonPage = () => {
//     return new Promise(async (resolve, reject) => {
//         try {
//             const amazonPage = await axios.get("")
//         } catch (err) {
//             reject(err);
//         }
//     });
// };

// const audio = new Howl("./audio.mp3");
// audio.play();
